/**
 * Shared FAQ data — the single source of truth for the store's help
 * answers. The FAQ screen, the Customer Service center and Ask Bea all
 * read from here so the answers can never drift apart. Content is the
 * store's real policy copy — do not invent new policies here.
 */

export type FaqTopicId =
  | "delivery"
  | "payments"
  | "orders"
  | "account"
  | "products"
  | "contact";

export interface FaqTopic {
  id: FaqTopicId;
  title: string;
  subtitle: string;
  /** Ionicons glyph name (typed loosely; validated at render). */
  icon: string;
  /** Full policy screen to link, when one covers this topic. */
  policySlug?: string;
}

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: "delivery",
    title: "Delivery & returns",
    subtitle: "Shipping times, tracking, returns",
    icon: "cube-outline",
    policySlug: "shipping-policy",
  },
  {
    id: "payments",
    title: "Payments & refunds",
    subtitle: "Payment safety, refunds, promo codes",
    icon: "card-outline",
    policySlug: "refund-policy",
  },
  {
    id: "orders",
    title: "Order issues",
    subtitle: "Tracking, changes, cancellations",
    icon: "receipt-outline",
  },
  {
    id: "account",
    title: "Account & settings",
    subtitle: "Addresses, sign-in, your account",
    icon: "person-circle-outline",
    policySlug: "privacy-policy",
  },
  {
    id: "products",
    title: "Products & services",
    subtitle: "Custom designs, the catalog",
    icon: "shirt-outline",
  },
  {
    id: "contact",
    title: "Contact us",
    subtitle: "Email the Fam — we reply fast",
    icon: "mail-outline",
  },
];

export interface FaqEntry {
  q: string;
  a: string;
  topics: Exclude<FaqTopicId, "contact">[];
  /** Extra match words for search / Ask Bea intent scoring. */
  keywords: string[];
}

export const FAQS: FaqEntry[] = [
  {
    q: "Where do I track my order?",
    a: "Open Order History (Profile tab → Order History). Orders placed in the app show up instantly, and when you continue with your email there, every order on your account shows with live status and tracking as soon as it ships. You'll also get an order confirmation and a tracking email from the shop.",
    topics: ["orders", "delivery"],
    keywords: ["track", "tracking", "order", "package", "parcel", "where"],
  },
  {
    q: "How do returns and refunds work?",
    a: "If your item arrives damaged or there's a problem with your order, email contact@beatrackfam.info within a reasonable time and we'll make it right. Read the full Refund Policy under Profile → App Settings → Policies.",
    topics: ["payments", "delivery"],
    keywords: ["return", "refund", "exchange", "damaged", "broken", "wrong"],
  },
  {
    q: "When will my order ship?",
    a: "Custom merch is made to order — most pieces ship within the window listed in our Shipping Policy (Profile → App Settings → Policies). You'll get tracking as soon as it leaves.",
    topics: ["delivery"],
    keywords: ["ship", "shipping", "deliver", "delivery", "long", "arrive"],
  },
  {
    q: "How do I change my shipping address?",
    a: "Log in, open your Profile → Saved Addresses, and edit or add addresses there. To change the address on an order that already shipped, email us right away and we'll try to catch it.",
    topics: ["account", "orders"],
    keywords: ["address", "change", "edit", "move", "shipping address"],
  },
  {
    q: "Is my payment information safe?",
    a: "Yes. Checkout happens on Shopify's secure servers — cards, Apple Pay and Google Pay are all processed by Shopify. We never see or store your card numbers.",
    topics: ["payments"],
    keywords: ["payment", "pay", "card", "safe", "secure", "security"],
  },
  {
    q: "How do custom design requests work?",
    a: "Open Profile → Custom Design Request and describe your idea. It opens an email to us with your details — we'll reply to talk through the design, pricing and timing.",
    topics: ["products"],
    keywords: ["custom", "design", "request", "own design", "personalized"],
  },
];

/** Case-insensitive keyword score of a FAQ entry against free text. */
export function scoreFaq(entry: FaqEntry, text: string): number {
  const t = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const kw of entry.keywords) {
    if (t.includes(kw)) score += kw.length > 4 ? 2 : 1;
  }
  for (const word of entry.q.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length > 3 && t.includes(` ${word} `)) score += 1;
  }
  return score;
}

/** FAQ entries for one service-center topic. */
export function faqsForTopic(topic: FaqTopicId): FaqEntry[] {
  return FAQS.filter((f) => f.topics.includes(topic as FaqEntry["topics"][number]));
}

/** Free-text search across questions, answers and keywords. */
export function searchFaqs(query: string): FaqEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FAQS.map((f) => ({ f, s: scoreFaq(f, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.f);
}
