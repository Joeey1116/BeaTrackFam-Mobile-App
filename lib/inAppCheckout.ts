/**
 * Full in-app checkout client (Stripe PaymentSheet + the Cloudflare
 * site backend's embedded-intent endpoints).
 *
 * Flow (mirrors the site's embedded checkout page):
 *   1. quoteInAppCheckout() creates the site order (pending_payment)
 *      + PaymentIntent, then re-prices it with the buyer's address and
 *      chosen shipping rate — the intent amount is the exact total.
 *   2. The app initializes + presents Stripe's PaymentSheet with the
 *      returned client_secret (see app/checkout.tsx).
 *   3. After PaymentSheet reports success, the site's Stripe webhook
 *      flips the order to paid; confirmInAppOrder() best-effort checks
 *      the order exists via guest lookup so the receipt carries the
 *      real site order number (BTF-YYYYMMDD-XXXX).
 *
 * Money: the site API speaks integer cents everywhere. This module
 * converts to dollars ONLY at the boundary (InAppQuote.totals/lines),
 * because the checkout screen renders dollars; totalsCents is kept
 * alongside so nothing downstream has to re-derive cents from floats.
 * Tax is $0 — Stripe Tax is not connected on the site.
 * Currency follows the ship-to country: US -> USD, CA -> CAD, MX -> MXN.
 * A PaymentIntent's currency can't change, so a country switch means
 * a fresh intent (the old pending order is abandoned, same as the web
 * checkout page does).
 *
 * Promo codes: the embedded-intent endpoints take ONE discount_code
 * (plus an affiliate_code for attribution). The app still lets the
 * shopper enter up to 2 codes and validates each one individually
 * against /api/discounts/validate, but only the first applied code
 * rides the intent — any extra applied code is reported back in
 * rejectedCodes so the screen tells the shopper it didn't stick,
 * instead of silently dropping it. True FREESHIP + subtotal-code
 * stacking needs a backend change to the intent endpoints (follow-up,
 * not silently faked here).
 */
import { SITE_BACKEND_URL } from "./checkoutConfig";

/* ------------------------------- Input types ------------------------------ */

/** One cart line, keyed the way the site catalog keys it. */
export interface CheckoutCartLine {
  handle: string;
  variant: string;
  qty: number;
}

export interface CheckoutBuyer {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  /** State / province code or name, as typed. */
  provinceCode: string;
  zip: string;
  /** US | CA | MX */
  countryCode: string;
}

/* ------------------------------ Output types ------------------------------ */

export interface InAppQuoteLine {
  handle?: string;
  title: string;
  variantTitle: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface InAppTotals {
  subtotal: number;
  /** Discount off the subtotal (affiliate / store code), dollars. */
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

export interface InAppQuote {
  /** Site order id (uuid) backing this intent. */
  orderId: string;
  /** Site order number, e.g. BTF-20261104-XXXX — the receipt key. */
  orderNumber: string;
  paymentIntentId: string;
  clientSecret: string;
  currency: string;
  totals: InAppTotals;
  totalsCents: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  };
  shippingTitle: string;
  appliedCodes: string[];
  rejectedCodes: string[];
  lines: InAppQuoteLine[];
}

export interface PromoValidation {
  appliedCodes: string[];
  rejectedCodes: string[];
  totals: InAppTotals;
  currency: string;
  lines: InAppQuoteLine[];
  shippingTitle: string;
}

export interface ShippingRateOption {
  id: string;
  name: string;
  priceCents: number;
  deliveryText: string;
}

/* --------------------------------- Helpers -------------------------------- */

export function currencyForCountry(countryCode: string): string {
  const c = (countryCode || "US").toUpperCase();
  return c === "CA" ? "CAD" : c === "MX" ? "MXN" : "USD";
}

/**
 * Normalize a stored country value to a ship-to code (US | CA | MX).
 * Saved addresses carry free text ("United States" is the address
 * form's default), which matches no country chip — returning null for
 * those keeps the screen in its honest "no country picked" state
 * instead of silently treating it as US.
 */
export function normalizeShipCountry(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "US" || v === "USA" || v === "UNITED STATES") return "US";
  if (v === "CA" || v === "CAN" || v === "CANADA") return "CA";
  if (v === "MX" || v === "MEX" || v === "MEXICO") return "MX";
  return null;
}

const centsToDollars = (cents: number): number => cents / 100;

async function callSite<T>(
  path: string,
  body: Record<string, unknown>,
  method = "POST"
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SITE_BACKEND_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Couldn't reach the store. Check your connection and try again."
    );
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || "Checkout hit a snag. Please try again.");
  }
  return data;
}

async function getSite<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SITE_BACKEND_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error(
      "Couldn't reach the store. Check your connection and try again."
    );
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || "Checkout hit a snag. Please try again.");
  }
  return data;
}

/* ------------------------------ Promo validation --------------------------- */

/**
 * Validates promo codes against the site (preview only — no intent is
 * created). Each code is checked individually via
 * GET /api/discounts/validate; a code the site rejects (unknown,
 * ineligible, non-combinable) lands in rejectedCodes. Used when the
 * shopper taps "Apply" so only codes the store itself accepts ever
 * stick.
 */
export async function validatePromoCodes(
  lines: CheckoutCartLine[],
  discountCodes: string[],
  opts?: { subtotalCents?: number; email?: string }
): Promise<PromoValidation> {
  const subtotalCents = opts?.subtotalCents ?? 0;
  const itemQty = lines.reduce((n, l) => n + l.qty, 0);
  const appliedCodes: string[] = [];
  const rejectedCodes: string[] = [];
  for (const raw of discountCodes) {
    const code = raw.trim().toUpperCase();
    if (!code) continue;
    if (appliedCodes.includes(code)) continue;
    const params = new URLSearchParams({
      code,
      subtotal_cents: String(subtotalCents),
      item_qty: String(itemQty),
      other_discount: appliedCodes.length > 0 ? "1" : "0",
    });
    if (opts?.email) params.set("email", opts.email);
    try {
      const res = await getSite<{
        valid?: boolean;
        needs_email?: boolean;
        discount_cents?: number;
        free_shipping?: boolean;
      }>(`/api/discounts/validate?${params.toString()}`);
      if (res.valid) appliedCodes.push(code);
      else rejectedCodes.push(code);
    } catch {
      rejectedCodes.push(code);
    }
  }
  // Preview totals: the intent itself is the authority at pay time, so
  // the screen shows the cart subtotal until a quote lands.
  const subtotal = centsToDollars(subtotalCents);
  return {
    appliedCodes,
    rejectedCodes,
    totals: {
      subtotal,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: subtotal,
      currency: "USD",
    },
    currency: "USD",
    lines: [],
    shippingTitle: "",
  };
}

/* ------------------------------- Shipping rates ---------------------------- */

/**
 * Shipping options for a ship-to country, in the session currency.
 * Stateless on the server — no order needed. FREESHIP zeroes the
 * Standard option only (the site's rule).
 */
export async function getShippingRates(
  country: string,
  currency: string,
  freeShipping = false
): Promise<ShippingRateOption[]> {
  const data = await callSite<{
    options?: Array<{
      id: string;
      name: string;
      price_cents: number;
      delivery_text?: string;
    }>;
  }>("/api/checkout/embedded-rates", {
    country: country.toUpperCase(),
    currency,
    free_shipping: freeShipping,
  });
  return (data.options ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    priceCents: o.price_cents,
    deliveryText: o.delivery_text ?? "",
  }));
}

/* --------------------------------- Quoting --------------------------------- */

interface CreateIntentResponse {
  order_id: string;
  order_number: string;
  payment_intent_id: string;
  client_secret: string;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  discount_status: string;
  free_shipping: boolean;
  total_cents: number;
  lines: Array<{
    title: string;
    variant_label: string;
    qty: number;
    image: string | null;
    unit_cents: number;
    line_cents: number;
  }>;
}

interface UpdateIntentResponse {
  order_id: string;
  order_number: string;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  discount_status: string;
  free_shipping: boolean;
  shipping_cents: number;
  total_cents: number;
}

function toQuote(
  created: CreateIntentResponse,
  updated: UpdateIntentResponse | null,
  lines: InAppQuoteLine[],
  appliedCodes: string[],
  rejectedCodes: string[],
  shippingTitle: string
): InAppQuote {
  const subtotalCents = created.subtotal_cents;
  const shippingCents = updated?.shipping_cents ?? 0;
  // The backend returns subtotal BEFORE discount and discount_cents
  // separately; dropping the discount here is what hid the discount
  // line on the screen while the total still reflected it.
  const discountCents = updated?.discount_cents ?? created.discount_cents;
  const totalCents = updated?.total_cents ?? created.total_cents;
  return {
    orderId: created.order_id,
    orderNumber: created.order_number,
    paymentIntentId: created.payment_intent_id,
    clientSecret: created.client_secret,
    currency: created.currency,
    totals: {
      subtotal: centsToDollars(subtotalCents),
      discount: centsToDollars(discountCents),
      shipping: centsToDollars(shippingCents),
      tax: 0,
      total: centsToDollars(totalCents),
      currency: created.currency,
    },
    totalsCents: {
      subtotal: subtotalCents,
      discount: discountCents,
      shipping: shippingCents,
      tax: 0,
      total: totalCents,
    },
    shippingTitle,
    appliedCodes,
    rejectedCodes,
    lines,
  };
}

/**
 * Creates the site order + PaymentIntent for the exact cart, then
 * re-prices it with the buyer's address and shipping choice. Throws
 * with a customer-safe message on any failure (unknown handle,
 * rejected code, unavailable shipping option).
 *
 * Only discountCodes[0] rides the intent (the endpoint takes one
 * discount_code); extra codes are reported in rejectedCodes — see the
 * module header for why, and don't silently swallow them.
 */
export async function quoteInAppCheckout(
  lines: CheckoutCartLine[],
  discountCodes: string[],
  buyer: CheckoutBuyer,
  opts?: { shippingRateId?: string | null; affiliateCode?: string }
): Promise<InAppQuote> {
  if (lines.length === 0) throw new Error("Your cart is empty.");
  const currency = currencyForCountry(buyer.countryCode);
  const codes = discountCodes
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const created = await callSite<CreateIntentResponse>(
    "/api/checkout/create-embedded-intent",
    {
      items: lines.map((l) => ({
        handle: l.handle,
        variant: l.variant,
        qty: l.qty,
      })),
      discount_code: codes[0] ?? "",
      affiliate_code: opts?.affiliateCode ?? "",
      display_currency: currency,
    }
  );
  const appliedCodes: string[] = [];
  const rejectedCodes: string[] = [];
  if (codes.length > 0) {
    if (created.discount_status === "applied") appliedCodes.push(codes[0]);
    else rejectedCodes.push(codes[0]);
    // Extra codes can't ride this intent — say so, don't drop quietly.
    for (const extra of codes.slice(1)) rejectedCodes.push(extra);
  }
  const quoteLines: InAppQuoteLine[] = (created.lines ?? []).map((l) => ({
    title: l.title,
    variantTitle: l.variant_label,
    quantity: l.qty,
    unitAmount: centsToDollars(l.unit_cents),
    lineTotal: centsToDollars(l.line_cents),
    imageUrl: l.image ?? null,
  }));

  // Re-price with address + shipping. Shipping is required for a real
  // total: with no rate chosen, ask the server for the country's
  // options and take the first (Standard) — the screen lets the
  // shopper change it, which re-runs this update.
  let shippingRateId = opts?.shippingRateId ?? null;
  let shippingTitle = "";
  if (!shippingRateId) {
    const rates = await getShippingRates(
      buyer.countryCode,
      currency,
      created.free_shipping
    );
    shippingRateId = rates[0]?.id ?? null;
    shippingTitle = rates[0]?.name ?? "";
  }
  let updated: UpdateIntentResponse | null = null;
  if (shippingRateId) {
    updated = await callSite<UpdateIntentResponse>(
      "/api/checkout/update-embedded-intent",
      {
        order_id: created.order_id,
        payment_intent_id: created.payment_intent_id,
        currency,
        email: buyer.email,
        name: `${buyer.firstName} ${buyer.lastName}`.trim(),
        address: {
          address1: buyer.address1,
          address2: buyer.address2 ?? "",
          city: buyer.city,
          state: buyer.provinceCode,
          postal: buyer.zip,
          country: buyer.countryCode,
        },
        shipping_rate_id: shippingRateId,
      }
    );
  }
  return toQuote(created, updated, quoteLines, appliedCodes, rejectedCodes, shippingTitle);
}

/**
 * Re-prices an existing intent when the address, shipping option, or
 * email changes. Guarded server-side by the payment-intent-id match —
 * a mismatch throws, and the screen must re-quote from scratch.
 */
export async function updateInAppIntent(input: {
  orderId: string;
  paymentIntentId: string;
  currency: string;
  email?: string;
  name?: string;
  address?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postal: string;
    country: string;
  };
  shippingRateId?: string | null;
  discountCode?: string;
}): Promise<{
  orderNumber: string;
  currency: string;
  totalsCents: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
  };
  discountStatus: string;
  freeShipping: boolean;
}> {
  const body: Record<string, unknown> = {
    order_id: input.orderId,
    payment_intent_id: input.paymentIntentId,
    currency: input.currency,
  };
  if (input.email) body.email = input.email;
  if (input.name) body.name = input.name;
  if (input.address) body.address = input.address;
  if (input.shippingRateId) body.shipping_rate_id = input.shippingRateId;
  if (input.discountCode !== undefined) body.discount_code = input.discountCode;
  const res = await callSite<UpdateIntentResponse>(
    "/api/checkout/update-embedded-intent",
    body
  );
  return {
    orderNumber: res.order_number,
    currency: res.currency,
    totalsCents: {
      subtotal: res.subtotal_cents,
      discount: res.discount_cents,
      shipping: res.shipping_cents,
      total: res.total_cents,
    },
    discountStatus: res.discount_status,
    freeShipping: res.free_shipping,
  };
}

/* --------------------------------- Confirm --------------------------------- */

/**
 * After PaymentSheet reports success: best-effort check that the site
 * order exists (guest lookup by number + checkout email — the lookup
 * works for any status, so it answers even before the webhook flips
 * the order to paid). The PaymentSheet success itself IS the payment
 * confirmation; the webhook marks the order paid server-side. Returns
 * the site order number for the receipt. Never throws — callers fall
 * back to the quoted order number.
 */
export async function confirmInAppOrder(
  paymentIntentId: string,
  opts?: { orderNumber?: string; email?: string }
): Promise<{ orderId: string; orderName: string }> {
  void paymentIntentId;
  const orderNumber = opts?.orderNumber ?? "";
  if (orderNumber && opts?.email) {
    try {
      const res = await callSite<{ order?: { number?: string } }>(
        "/api/guest-order-lookup",
        { order_number: orderNumber, email: opts.email }
      );
      if (res.order?.number) {
        return { orderId: res.order.number, orderName: res.order.number };
      }
    } catch {
      // Fall through to the quoted number — the receipt still records.
    }
  }
  return { orderId: orderNumber, orderName: orderNumber };
}
