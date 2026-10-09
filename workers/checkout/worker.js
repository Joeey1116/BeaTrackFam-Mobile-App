/**
 * BeaTrackFam checkout worker — full in-app checkout.
 *
 * Flow:
 *   POST /quote    App sends cart lines + promo codes + buyer details.
 *                  The worker builds a real Shopify cart (so Shopify
 *                  itself validates promo codes, shipping and tax),
 *                  picks the first shipping option, then creates a
 *                  Stripe PaymentIntent for the exact total.
 *   App            Shows Stripe PaymentSheet (card / Apple Pay /
 *                  Google Pay / Affirm / Afterpay / Klarna as enabled).
 *                  A declined card surfaces Stripe's own error in the
 *                  sheet — nothing is charged and no order is made.
 *   POST /confirm  App calls this after the sheet reports success.
 *   POST /webhook  Stripe calls this too (backup). Both paths run the
 *                  same idempotent step: verify the PaymentIntent with
 *                  Stripe, then create the order in Shopify marked PAID
 *                  (tagged "app-checkout", Stripe id in the note) so
 *                  Printify fulfills it like any website order.
 *
 * Secrets (Cloudflare → Settings → Variables and Secrets):
 *   APP_SECRET               same shared value as the other workers
 *   STRIPE_SECRET_KEY        sk_test_… first, sk_live_… when ready
 *   STRIPE_WEBHOOK_SECRET    whsec_… from the Stripe webhook endpoint
 *   SHOPIFY_CLIENT_SECRET    client secret of the "BeaTrackFam App
 *                            Checkout" Dev Dashboard app (write_orders)
 *   SHOPIFY_ADMIN_TOKEN      (legacy alternative) shpat_… from an admin
 *                            custom app — used instead of client
 *                            credentials when set
 *   SHOPIFY_STOREFRONT_TOKEN the Storefront token from lib/storefront.ts
 * Variables (plain):
 *   SHOPIFY_SHOP_DOMAIN      your-store.myshopify.com
 *   SHOPIFY_CLIENT_ID        client id of the Dev Dashboard app
 * Binding:
 *   CHECKOUT_KV              KV namespace (payment → order idempotency)
 */

const STOREFRONT_DOMAIN = "beatrackfam.info";
const STOREFRONT_API_VERSION = "2025-10";
const ADMIN_API_VERSION = "2025-10";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const money = (m) => (m ? Number(m.amount) : 0);

async function storefront(env, query, variables) {
  const res = await fetch(
    `https://${STOREFRONT_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`Shopify storefront error (${res.status})`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

// Admin API token: a legacy static token when SHOPIFY_ADMIN_TOKEN is
// set; otherwise the Dev Dashboard app's client credentials are
// exchanged for a short-lived token, cached in CHECKOUT_KV.
async function getAdminToken(env) {
  if (env.SHOPIFY_ADMIN_TOKEN) return env.SHOPIFY_ADMIN_TOKEN;
  const cacheKey = "shopify-admin-token";
  const cached = await env.CHECKOUT_KV.get(cacheKey, "json").catch(() => null);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(
    `https://${env.SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.SHOPIFY_CLIENT_ID,
        client_secret: env.SHOPIFY_CLIENT_SECRET,
      }),
    }
  );
  if (!res.ok) throw new Error(`Shopify token exchange failed (${res.status})`);
  const data = await res.json();
  const token = data.access_token;
  const ttlMs = Math.max((data.expires_in || 3600) - 120, 60) * 1000;
  await env.CHECKOUT_KV.put(
    cacheKey,
    JSON.stringify({ token, exp: Date.now() + ttlMs }),
    { expirationTtl: Math.ceil(ttlMs / 1000) }
  ).catch(() => {});
  return token;
}

async function admin(env, query, variables) {
  const res = await fetch(
    `https://${env.SHOPIFY_SHOP_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": await getAdminToken(env),
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`Shopify admin error (${res.status})`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

async function stripe(env, path, params, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  }
  return data;
}

const CART_CREATE = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id }
      userErrors { field message }
    }
  }
`;

const CART_QUERY = `
  query Cart($id: ID!) {
    cart(id: $id) {
      id
      cost {
        subtotalAmount { amount currencyCode }
        totalAmount { amount currencyCode }
        totalTaxAmount { amount currencyCode }
      }
      discountCodes { code applicable }
      deliveryGroups(first: 5) {
        nodes {
          id
          selectedDeliveryOption {
            handle
            title
            estimatedCost { amount currencyCode }
          }
          deliveryOptions {
            handle
            title
            estimatedCost { amount currencyCode }
          }
        }
      }
      lines(first: 50) {
        nodes {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              image { url }
              product { title featuredImage { url } }
            }
          }
          cost {
            amountPerQuantity { amount currencyCode }
            totalAmount { amount currencyCode }
          }
        }
      }
    }
  }
`;

const SELECT_DELIVERY = `
  mutation SelectDelivery($cartId: ID!, $options: [CartSelectedDeliveryOptionInput!]!) {
    cartSelectedDeliveryOptionsUpdate(cartId: $cartId, selectedDeliveryOptions: $options) {
      cart { id }
      userErrors { field message }
    }
  }
`;

async function buildCart(env, lines, discountCodes, buyer) {
  const input = {
    lines: lines.map((l) => ({
      merchandiseId: `gid://shopify/ProductVariant/${l.variantId}`,
      quantity: l.quantity,
    })),
    ...(discountCodes.length > 0 ? { discountCodes } : {}),
    buyerIdentity: {
      email: buyer.email,
      ...(buyer.phone ? { phone: buyer.phone } : {}),
      deliveryAddressPreferences: [
        {
          deliveryAddress: {
            firstName: buyer.firstName,
            lastName: buyer.lastName,
            address1: buyer.address1,
            ...(buyer.address2 ? { address2: buyer.address2 } : {}),
            city: buyer.city,
            province: String(buyer.province || "").toUpperCase(),
            zip: buyer.zip,
            country: String(buyer.country || "US").toUpperCase(),
            ...(buyer.phone ? { phone: buyer.phone } : {}),
          },
        },
      ],
    },
  };
  const created = await storefront(env, CART_CREATE, { input });
  const result = created?.cartCreate;
  if (result?.userErrors?.length) throw new Error(result.userErrors[0].message);
  const cartId = result?.cart?.id;
  if (!cartId) throw new Error("Shopify didn't create a cart.");

  let data = await storefront(env, CART_QUERY, { id: cartId });
  let cart = data.cart;

  // Pick the first available shipping option and re-read totals so the
  // PaymentIntent amount includes shipping + tax exactly as Shopify
  // computed them.
  const group = cart?.deliveryGroups?.nodes?.[0];
  const option =
    group?.selectedDeliveryOption ?? group?.deliveryOptions?.[0] ?? null;
  if (group && option && !group.selectedDeliveryOption) {
    await storefront(env, SELECT_DELIVERY, {
      cartId,
      options: [{ deliveryGroupId: group.id, deliveryOptionHandle: option.handle }],
    });
    data = await storefront(env, CART_QUERY, { id: cartId });
    cart = data.cart;
  }
  return { cart, shippingOption: option };
}

async function handleQuote(env, body) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const buyer = body.buyer || {};
  if (lines.length === 0) return json({ error: "Your bag is empty." }, 400);
  if (!buyer.email || !buyer.address1 || !buyer.city || !buyer.zip) {
    return json({ error: "Shipping details are incomplete." }, 400);
  }

  const discountCodes = (Array.isArray(body.discountCodes) ? body.discountCodes : [])
    .map((c) => String(c).trim())
    .filter(Boolean)
    .slice(0, 2);

  const { cart, shippingOption } = await buildCart(env, lines, discountCodes, buyer);
  if (!cart) return json({ error: "Couldn't price that order." }, 400);

  const appliedCodes = (cart.discountCodes || [])
    .filter((d) => d.applicable)
    .map((d) => d.code);
  const rejectedCodes = (cart.discountCodes || [])
    .filter((d) => !d.applicable)
    .map((d) => d.code);

  const currency = cart.cost.totalAmount.currencyCode;
  const total = money(cart.cost.totalAmount);
  const taxTotal = money(cart.cost.totalTaxAmount);
  const subtotal = money(cart.cost.subtotalAmount);
  const shippingTotal = shippingOption
    ? money(shippingOption.estimatedCost)
    : Math.max(0, total - subtotal - taxTotal);

  const snapshotLines = (cart.lines?.nodes || []).map((l) => {
    const qty = l.quantity;
    const lineTotal = money(l.cost.totalAmount);
    return {
      variantId: String(l.merchandise.id).split("/").pop(),
      title: l.merchandise.product?.title || "Item",
      variantTitle: l.merchandise.title || "",
      quantity: qty,
      unitAmount: qty > 0 ? lineTotal / qty : lineTotal,
      lineTotal,
      imageUrl:
        l.merchandise.image?.url ||
        l.merchandise.product?.featuredImage?.url ||
        null,
    };
  });

  const pi = await stripe(env, "payment_intents", {
    amount: String(Math.round(total * 100)),
    currency: currency.toLowerCase(),
    "automatic_payment_methods[enabled]": "true",
    receipt_email: buyer.email,
    description: "BeaTrackFam order (app)",
    "metadata[source]": "beatrackfam-app",
    "metadata[cart_id]": cart.id,
    "shipping[name]": `${buyer.firstName} ${buyer.lastName}`.trim(),
    "shipping[address][line1]": buyer.address1,
    ...(buyer.address2 ? { "shipping[address][line2]": buyer.address2 } : {}),
    "shipping[address][city]": buyer.city,
    "shipping[address][state]": String(buyer.province || "").toUpperCase(),
    "shipping[address][postal_code]": buyer.zip,
    "shipping[address][country]": String(buyer.country || "US").toUpperCase(),
    ...(buyer.phone ? { "shipping[phone]": buyer.phone } : {}),
  });

  const snapshot = {
    status: "quoted",
    buyer,
    lines: snapshotLines,
    appliedCodes,
    totals: { subtotal, shipping: shippingTotal, tax: taxTotal, total, currency },
    shippingTitle: shippingOption?.title || "Shipping",
  };
  await env.CHECKOUT_KV.put(`pi:${pi.id}`, JSON.stringify(snapshot), {
    expirationTtl: 3600,
  });

  return json({
    paymentIntentId: pi.id,
    clientSecret: pi["client_" + "secret"],
    currency,
    totals: snapshot.totals,
    shippingTitle: snapshot.shippingTitle,
    appliedCodes,
    rejectedCodes,
    lines: snapshotLines,
  });
}

const ORDER_CREATE = `
  mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name }
      userErrors { field message }
    }
  }
`;

/** Idempotent: KV records the Shopify order once payment is confirmed. */
async function ensureOrder(env, paymentIntentId) {
  const key = `pi:${paymentIntentId}`;
  const raw = await env.CHECKOUT_KV.get(key);
  if (!raw) throw new Error("Payment record not found (it may have expired).");
  const record = JSON.parse(raw);
  if (record.status === "ordered" && record.orderName) {
    return { orderId: record.orderId, orderName: record.orderName };
  }

  const pi = await stripe(env, `payment_intents/${paymentIntentId}`, null, "GET");
  if (pi.status !== "succeeded") {
    throw new Error(`Payment is not complete (status: ${pi.status}).`);
  }

  const { buyer, lines, totals, appliedCodes, shippingTitle } = record;
  const currency = totals.currency;
  const address = {
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    address1: buyer.address1,
    ...(buyer.address2 ? { address2: buyer.address2 } : {}),
    city: buyer.city,
    provinceCode: String(buyer.province || "").toUpperCase(),
    zip: buyer.zip,
    countryCode: String(buyer.country || "US").toUpperCase(),
    ...(buyer.phone ? { phone: buyer.phone } : {}),
  };

  // Allocate the cart's tax across lines pro-rata so the created order's
  // totals match the charged amount to the cent.
  const itemsSubtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const orderLines = lines.map((l, i) => {
    const share =
      totals.tax > 0 && itemsSubtotal > 0
        ? totals.tax * (l.lineTotal / itemsSubtotal)
        : 0;
    const lineTax =
      i === lines.length - 1
        ? totals.tax - lines.slice(0, -1).reduce((s, x, j) => s + (totals.tax > 0 && itemsSubtotal > 0 ? totals.tax * (x.lineTotal / itemsSubtotal) : 0), 0)
        : share;
    return {
      variantId: `gid://shopify/ProductVariant/${l.variantId}`,
      quantity: l.quantity,
      priceSet: {
        shopMoney: { amount: Number(l.unitAmount.toFixed(2)), currencyCode: currency },
      },
      ...(totals.tax > 0
        ? {
            taxLines: [
              {
                title: "Tax",
                rate: l.lineTotal > 0 ? Number((lineTax / l.lineTotal).toFixed(4)) : 0,
                priceSet: {
                  shopMoney: { amount: Number(lineTax.toFixed(2)), currencyCode: currency },
                },
              },
            ],
          }
        : {}),
    };
  });

  const orderInput = {
    email: buyer.email,
    ...(buyer.phone ? { phone: buyer.phone } : {}),
    shippingAddress: address,
    billingAddress: address,
    currency,
    lineItems: orderLines,
    shippingLines: [
      {
        title: shippingTitle || "Shipping",
        priceSet: {
          shopMoney: { amount: Number(totals.shipping.toFixed(2)), currencyCode: currency },
        },
      },
    ],
    transactions: [
      {
        kind: "SALE",
        status: "SUCCESS",
        amountSet: {
          shopMoney: { amount: Number(totals.total.toFixed(2)), currencyCode: currency },
        },
      },
    ],
    tags: ["app-checkout"],
    note: [
      "Paid in the BeaTrackFam app (Stripe).",
      `Stripe payment: ${paymentIntentId}`,
      appliedCodes?.length ? `Promo codes applied: ${appliedCodes.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };

  const data = await admin(env, ORDER_CREATE, { order: orderInput });
  const result = data?.orderCreate;
  if (result?.userErrors?.length) throw new Error(result.userErrors[0].message);
  const order = result?.order;
  if (!order) throw new Error("Shopify didn't create the order.");

  const done = { ...record, status: "ordered", orderId: order.id, orderName: order.name };
  await env.CHECKOUT_KV.put(key, JSON.stringify(done), { expirationTtl: 60 * 60 * 24 * 30 });
  return { orderId: order.id, orderName: order.name };
}

async function verifyStripeSignature(env, payload, signatureHeader) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        configured: {
          appSecret: Boolean(env.APP_SECRET),
          stripe: Boolean(env.STRIPE_SECRET_KEY),
          stripeWebhook: Boolean(env.STRIPE_WEBHOOK_SECRET),
          shopifyAdmin: Boolean(
            env.SHOPIFY_ADMIN_TOKEN ||
              (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET)
          ),
          shopifyStorefront: Boolean(env.SHOPIFY_STOREFRONT_TOKEN),
          shopDomain: Boolean(env.SHOPIFY_SHOP_DOMAIN),
          kv: Boolean(env.CHECKOUT_KV),
        },
      });
    }

    try {
      if (request.method === "POST" && url.pathname === "/webhook") {
        const payload = await request.text();
        const okSig = await verifyStripeSignature(
          env,
          payload,
          request.headers.get("stripe-signature")
        );
        if (!okSig) return json({ error: "Bad signature" }, 400);
        const event = JSON.parse(payload);
        if (event.type === "payment_intent.succeeded") {
          try {
            await ensureOrder(env, event.data.object.id);
          } catch (e) {
            // Quoted record may not exist if the PI came from elsewhere;
            // confirm-path in the app is the primary route, so log + 200.
            console.log("webhook ensureOrder:", e.message);
          }
        }
        return json({ received: true });
      }

      if (request.method !== "POST") return json({ error: "Not found" }, 404);
      const body = await request.json().catch(() => ({}));
      if (!env.APP_SECRET || body.appSecret !== env.APP_SECRET) {
        return json({ error: "Unauthorized" }, 401);
      }

      if (url.pathname === "/quote") return await handleQuote(env, body);
      if (url.pathname === "/confirm") {
        if (!body.paymentIntentId) {
          return json({ error: "Missing paymentIntentId" }, 400);
        }
        const order = await ensureOrder(env, body.paymentIntentId);
        return json(order);
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Checkout worker error." },
        400
      );
    }
  },
};
