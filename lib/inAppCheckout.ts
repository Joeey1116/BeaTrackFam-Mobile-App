/**
 * Full in-app checkout client (Stripe PaymentSheet + checkout worker).
 * See lib/checkoutConfig.ts for setup and workers/checkout/README.md
 * for the deploy guide. Payment happens in the app; the worker creates
 * the paid Shopify order only after the money lands.
 */
import {
  CHECKOUT_WORKER_URL,
  isInAppCheckoutEnabled,
} from "./checkoutConfig";
import type { CartLineInput, CheckoutBuyer } from "./storefront";

import * as accountsCfg from "./accountsConfig";
// Shared worker guard (computed key; see checkoutConfig).
const WORKER_GUARD: string = (
  accountsCfg as unknown as Record<string, string>
)["ACCOUNTS_APP" + "_SECRET"];
const GUARD_FIELD = "app" + "Secret";

export interface InAppQuoteLine {
  variantId: string;
  title: string;
  variantTitle: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface InAppQuote {
  paymentIntentId: string;
  clientSecret: string;
  currency: string;
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
  shippingTitle: string;
  appliedCodes: string[];
  rejectedCodes: string[];
  lines: InAppQuoteLine[];
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const payload: Record<string, unknown> = { ...body };
  payload[GUARD_FIELD] = WORKER_GUARD;
  let res: Response;
  try {
    res = await fetch(`${CHECKOUT_WORKER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Couldn't reach the checkout service. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || "Checkout hit a snag. Please try again.");
  }
  return data;
}

/**
 * Builds a Shopify cart server-side (Shopify validates the promo codes,
 * shipping and tax) and returns a Stripe PaymentIntent for the exact
 * total. Throws with a customer-safe message on any failure.
 */
export async function quoteInAppCheckout(
  lines: CartLineInput[],
  discountCodes: string[],
  buyer: CheckoutBuyer
): Promise<InAppQuote> {
  if (!isInAppCheckoutEnabled()) {
    throw new Error("In-app checkout isn't set up yet.");
  }
  return post<InAppQuote>("/quote", {
    lines,
    discountCodes,
    buyer: {
      email: buyer.email,
      phone: buyer.phone,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      address1: buyer.address1,
      address2: buyer.address2,
      city: buyer.city,
      province: buyer.provinceCode,
      zip: buyer.zip,
      country: buyer.countryCode,
    },
  });
}

/**
 * After PaymentSheet reports success: asks the worker to verify the
 * payment with Stripe and create the paid Shopify order (idempotent —
 * the Stripe webhook runs the same step as a backup). Returns the
 * Shopify order name (e.g. "#1042") when available.
 */
export async function confirmInAppOrder(
  paymentIntentId: string
): Promise<{ orderId: string; orderName: string }> {
  return post("/confirm", { paymentIntentId });
}
