/**
 * Ask Bea — the assistant's brain (12.1.0, Phase 2).
 *
 * Bea v1 is a smart guide over the store's real data, not a generative
 * AI: product search + prices from the live catalog (lib/shopify),
 * order status/tracking from the customer's real orders, and policy
 * answers from the shared FAQ data (data/faq.ts). Anything she can't
 * answer from that data falls back to the best-matching FAQ entries and
 * a human handoff at contact@beatrackfam.info. She never invents
 * products, prices, orders or promo codes.
 */
import type { CustomerOrder } from "./customer";
import type { AppAccount, OrderReceipt } from "./accounts";
import { formatMoney, type Product } from "./shopify";
import { FAQS, scoreFaq, type FaqEntry } from "../data/faq";
import { receiptStatusLabel, shopifyStatusLabel } from "./inbox";

export const CONTACT_EMAIL = "contact@beatrackfam.info";

export type BeaRoute =
  | { pathname: "/settings/order-history" }
  | { pathname: "/settings/faq" }
  | { pathname: "/settings/support" }
  | { pathname: "/settings/design-request" }
  | { pathname: "/profile/addresses" }
  | { pathname: "/(tabs)/collections" }
  | { pathname: "/settings/order/shopify"; params: { id: string } }
  | { pathname: "/settings/order/[id]"; params: { id: string } }
  | { pathname: "/product/[id]"; params: { id: string } }
  | { pathname: "/settings/policies/[slug]"; params: { slug: string } };

export interface BeaAction {
  label: string;
  route?: BeaRoute;
  /** External URL (mailto:) — opened via Linking. */
  url?: string;
}

export interface BeaReply {
  text: string;
  products?: Product[];
  actions?: BeaAction[];
  faqs?: FaqEntry[];
  /** When set, the next free-text message is treated as this kind of input. */
  awaitInput?: "product";
}

export interface BeaContext {
  products: Product[];
  account: AppAccount | null;
  localOrders: OrderReceipt[];
  shopifyOrders: CustomerOrder[];
}

const lc = (s: string) => s.toLowerCase().trim();
const has = (text: string, ...words: string[]) =>
  words.some((w) => lc(text).includes(w));

const HUMAN_ACTION: BeaAction = {
  label: `Email us — ${CONTACT_EMAIL}`,
  url: `mailto:${CONTACT_EMAIL}`,
};
const ORDERS_ACTION: BeaAction = {
  label: "Open Order History",
  route: { pathname: "/settings/order-history" },
};

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/* ----------------------------- Product search ---------------------------- */

const STOPWORDS = new Set([
  "find", "show", "looking", "search", "product", "products", "item",
  "items", "buy", "get", "have", "you", "any", "some", "want", "need",
  "shop", "bea", "please", "the", "for", "with", "and", "that", "this",
  "what", "much", "cost", "price", "how", "got", "sell", "there",
]);

function singular(token: string): string {
  return token.length > 3 && token.endsWith("s")
    ? token.slice(0, -1)
    : token;
}

export function searchProducts(
  products: Product[],
  query: string,
  limit = 3
): Product[] {
  const tokens = lc(query)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map(singular)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  if (tokens.length === 0) return [];

  const scored = products
    .map((p) => {
      const title = lc(p.title);
      const handle = lc(p.handle).replace(/-/g, " ");
      const desc = lc(p.description);
      let score = 0;
      for (const t of tokens) {
        if (title.includes(t)) score += 3;
        if (handle.includes(t)) score += 2;
        if (desc.includes(t)) score += 1;
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}

/* ------------------------------ Order replies ---------------------------- */

function latestOrderReply(ctx: BeaContext): BeaReply {
  const latestShopify = [...ctx.shopifyOrders].sort(
    (a, b) => Date.parse(b.processedAt) - Date.parse(a.processedAt)
  )[0];
  if (latestShopify) {
    const status = shopifyStatusLabel(latestShopify);
    return {
      text: `Your latest order ${latestShopify.name} is ${status.toLowerCase()} — placed ${dateLabel(latestShopify.processedAt)}, ${formatMoney(latestShopify.totalPrice)} total. Tap below for the full details and tracking.`,
      actions: [
        {
          label: `View order ${latestShopify.name}`,
          route: {
            pathname: "/settings/order/shopify",
            params: { id: latestShopify.id },
          },
        },
        ORDERS_ACTION,
      ],
    };
  }
  const latestLocal = [...ctx.localOrders].sort(
    (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt)
  )[0];
  if (latestLocal) {
    const status = receiptStatusLabel(latestLocal);
    return {
      text: `Your latest in-app order is ${status.toLowerCase()} — placed ${dateLabel(latestLocal.placedAt)}, ${formatMoney({ amount: latestLocal.totalAmount, currencyCode: latestLocal.currencyCode })} total. Full details are in Order History.`,
      actions: [
        {
          label: "View the order",
          route: {
            pathname: "/settings/order/[id]",
            params: { id: latestLocal.id },
          },
        },
        ORDERS_ACTION,
      ],
    };
  }
  if (ctx.account) {
    return {
      text: `I don't see any orders on your account yet. If you checked out as a guest, you can find that order with your order number + email in Order History — or sign in there with your email to pull up everything.`,
      actions: [ORDERS_ACTION, HUMAN_ACTION],
    };
  }
  return {
    text: `I can check that for you — open Order History and either continue with your email (Shopify sends you a sign-in code) or use the guest lookup with your order number + the email from checkout.`,
    actions: [ORDERS_ACTION, HUMAN_ACTION],
  };
}

function orderNumberReply(ctx: BeaContext, digits: string): BeaReply {
  const matchDigits = (name: string) =>
    name.replace(/\D/g, "") === digits;
  const shopifyHit = ctx.shopifyOrders.find((o) => matchDigits(o.name));
  if (shopifyHit) {
    const status = shopifyStatusLabel(shopifyHit);
    return {
      text: `Found it — order ${shopifyHit.name} is ${status.toLowerCase()} (placed ${dateLabel(shopifyHit.processedAt)}, ${formatMoney(shopifyHit.totalPrice)}). Tap below for details and tracking.`,
      actions: [
        {
          label: `View order ${shopifyHit.name}`,
          route: {
            pathname: "/settings/order/shopify",
            params: { id: shopifyHit.id },
          },
        },
      ],
    };
  }
  const localHit = ctx.localOrders.find((o) => matchDigits(o.id));
  if (localHit) {
    return {
      text: `Found it in your in-app orders — status: ${receiptStatusLabel(localHit).toLowerCase()}, placed ${dateLabel(localHit.placedAt)}.`,
      actions: [
        {
          label: "View the order",
          route: {
            pathname: "/settings/order/[id]",
            params: { id: localHit.id },
          },
        },
      ],
    };
  }
  return {
    text: `I couldn't find order #${digits} in the orders I can see. If you checked out as a guest, the guest lookup in Order History (order number + checkout email) will pull it up — or email us and we'll dig in.`,
    actions: [ORDERS_ACTION, HUMAN_ACTION],
  };
}

/* --------------------------------- Brain --------------------------------- */

export function answerBea(raw: string, ctx: BeaContext): BeaReply {
  const text = lc(raw);
  if (!text) {
    return {
      text: "Ask me about products, your orders, shipping, returns or promo codes — or tap “Talk to a human” any time.",
    };
  }

  // Specific order number wins over generic order talk.
  const numMatch = text.match(/#?\b(\d{3,})\b/);
  if (numMatch && has(text, "order", "#", "track")) {
    return orderNumberReply(ctx, numMatch[1]);
  }

  if (
    has(text, "human", "real person", "agent", "someone real", "contact", "talk to")
  ) {
    return {
      text: `Of course — the Fam answers email personally at ${CONTACT_EMAIL}. Tell them what you need and mention you came from the app. The Customer Service center has the quick answers too.`,
      actions: [
        HUMAN_ACTION,
        { label: "Customer Service center", route: { pathname: "/settings/support" } },
      ],
    };
  }

  if (
    has(text, "track", "where's my", "wheres my", "where is my", "my order", "package", "parcel", "order status", "shipped yet")
  ) {
    return latestOrderReply(ctx);
  }

  if (has(text, "promo", "discount", "coupon", "promo code", "code", "sale", "deal", "offer")) {
    return {
      text: "If you have a promo code, enter it at checkout — Shopify checks it and applies it right there before you pay. New codes go out through the Inbox bell and our announcements, so keep an eye there. I can't generate codes, but I can help you find something worth using one on.",
      actions: [
        { label: "Shop the catalog", route: { pathname: "/(tabs)/collections" } },
        HUMAN_ACTION,
      ],
    };
  }

  if (has(text, "find a product", "find me", "looking for", "show me")) {
    const rest = text
      .replace("find a product", "")
      .replace("find me", "")
      .replace("looking for", "")
      .replace("show me", "")
      .trim();
    if (rest.length > 2) return productReply(ctx, rest);
    return {
      text: "Love it — what are you looking for? A hoodie, a fresh tee, something for a gift? Type it and I'll search the shop for real.",
      awaitInput: "product",
    };
  }

  // FAQ-driven intents (returns, shipping, address, payment safety, design).
  const scored = FAQS.map((f) => ({ f, s: scoreFaq(f, text) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const top = scored[0];
  if (top && top.s >= 2) {
    const policy = policyActionFor(top.f);
    return {
      text: top.f.a,
      actions: policy ? [policy, HUMAN_ACTION] : [HUMAN_ACTION],
      faqs: scored.slice(1, 3).map((x) => x.f),
    };
  }

  // Product-y question (incl. "how much is X").
  const productHits = searchProducts(ctx.products, raw);
  if (productHits.length > 0) return productReplyFromHits(productHits);

  if (
    text.length <= 12 &&
    has(text, "hi", "hello", "hey", "yo", "sup", "morning", "afternoon")
  ) {
    return {
      text: "Hey Fam! I can search the shop, check your orders, or answer shipping & returns questions. What do you need?",
    };
  }

  return {
    text: "I want to give you the right answer, not a guess — here's the closest help I found. Still stuck? The Fam answers email personally.",
    faqs: FAQS.slice(0, 3),
    actions: [
      { label: "Open the FAQ", route: { pathname: "/settings/faq" } },
      HUMAN_ACTION,
    ],
  };
}

function policyActionFor(entry: FaqEntry): BeaAction | null {
  if (entry.keywords.includes("return") || entry.keywords.includes("refund")) {
    return {
      label: "Read the Refund Policy",
      route: { pathname: "/settings/policies/[slug]", params: { slug: "refund-policy" } },
    };
  }
  if (entry.keywords.includes("ship")) {
    return {
      label: "Read the Shipping Policy",
      route: { pathname: "/settings/policies/[slug]", params: { slug: "shipping-policy" } },
    };
  }
  if (entry.topics.includes("products")) {
    return {
      label: "Start a design request",
      route: { pathname: "/settings/design-request" },
    };
  }
  if (entry.topics.includes("account")) {
    return {
      label: "Saved addresses",
      route: { pathname: "/profile/addresses" },
    };
  }
  return null;
}

export function answerProductQuery(raw: string, ctx: BeaContext): BeaReply {
  return productReply(ctx, raw);
}

function productReply(ctx: BeaContext, query: string): BeaReply {
  const hits = searchProducts(ctx.products, query);
  if (hits.length === 0) {
    return {
      text: `I searched the shop for “${query}” and came up empty. Try a simpler word — like hoodie, tee, crewneck or mug — or browse the full catalog.`,
      actions: [
        { label: "Browse the shop", route: { pathname: "/(tabs)/collections" } },
        HUMAN_ACTION,
      ],
      awaitInput: "product",
    };
  }
  return productReplyFromHits(hits);
}

function productReplyFromHits(hits: Product[]): BeaReply {
  const names = hits.map((p) => p.title).join(", ");
  return {
    text: `Here's what I found in the shop right now: ${names}. Tap one to see sizes and details.`,
    products: hits,
  };
}
