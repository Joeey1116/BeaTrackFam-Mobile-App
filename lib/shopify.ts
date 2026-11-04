/**
 * Cloudflare data layer — live BeaTrackFam catalog.
 *
 * The app reads ONE public endpoint from the Cloudflare storefront
 * (no API key ships in the app, no Shopify calls of any kind):
 *
 *   GET https://beatrackfam.info/api/catalog
 *
 * The payload shape is the binding contract shared with checkout:
 * products keyed by handle, variants keyed by full variant title,
 * money in integer cents only. See
 * ~/workspace/beatrackfam-migration/api-catalog-contract.md.
 *
 * Real-data rules enforced here (never papered over):
 * - Products with zero priced variants (unpriced seed rows only in D1)
 *   are NOT buyable: `isBuyableProduct` is false for them and the
 *   listing fetchers below exclude them from shop listings.
 * - `compare_at_price_cents` is null for every variant today: null
 *   means "no compare-at price" — never render a null price.
 * - Unavailable variants stay in the payload so pickers can grey them
 *   out, but they must never enter the cart (see store/shop.tsx).
 * - D1 has NO per-variant images: variants carry no image field and
 *   none is invented. Screens use the product images only.
 */

export const STOREFRONT_DOMAIN = "beatrackfam.info";
export const CATALOG_URL = `https://${STOREFRONT_DOMAIN}/api/catalog`;

/* ---------------------------------- Types ---------------------------------- */

/** Binding contract: one priced variant of one product. */
export interface ProductVariant {
  /** Full variant title, e.g. "S / Black". */
  title: string;
  /** Title split on " / " (position order, no option names in D1). */
  options: string[];
  /** Integer cents. */
  price_cents: number;
  /** Integer cents, or null = no compare-at price. */
  compare_at_price_cents: number | null;
  available: boolean;
}

/** Binding contract: one catalog product, keyed by handle. */
export interface Product {
  handle: string;
  title: string;
  /** "" for every product today (catalog_product_meta is empty). */
  vendor: string;
  description: string;
  /** Main R2 URL. */
  image: string;
  /** R2 URLs — [main image] today; a gallery array if admin sets one. */
  images: string[];
  collection_title: string;
  tags: string[];
  /** [] for products with only unpriced seed rows in D1. */
  variants: ProductVariant[];
}

/** Binding contract: one catalog collection. */
export interface Collection {
  handle: string;
  title: string;
  /** R2 URL. */
  image: string;
  /** Handles of the visible products in this collection, in order. */
  product_handles: string[];
}

/** Raw GET /api/catalog payload. */
export interface CatalogResponse {
  products: Product[];
  collections: Collection[];
}

/** Binding contract: one cart line. Money in integer cents only. */
export interface CartLine {
  handle: string;
  variantTitle: string;
  /** Product title. */
  title: string;
  /** Integer cents (unit price). */
  price_cents: number;
  qty: number;
  /** Product main image URL. */
  image: string;
}

/** Checkout intent items are built as { handle, variant: variantTitle, qty }. */
export interface CheckoutIntentItem {
  handle: string;
  variant: string;
  qty: number;
}

export function cartLineToIntentItem(line: CartLine): CheckoutIntentItem {
  return { handle: line.handle, variant: line.variantTitle, qty: line.qty };
}

/* ---------------------------------- Money ---------------------------------- */

/**
 * Formats money. New code passes integer cents; the MoneyV2 object form
 * is kept so existing order/checkout screens that still hold
 * { amount, currencyCode } keep compiling and rendering identically.
 */
export function formatMoney(cents: number): string;
export function formatMoney(m: { amount: string; currencyCode: string }): string;
export function formatMoney(
  value: number | { amount: string; currencyCode: string }
): string {
  if (typeof value === "number") {
    return `$${(value / 100).toFixed(2)}`;
  }
  return `$${Number(value.amount).toFixed(2)}`;
}

/** Integer-cents formatting for a single value (same as formatMoney). */
export const formatCents = (cents: number): string => formatMoney(cents);

/* ------------------------------ Product helpers ----------------------------- */

/** False for the zero-variant products (unpriced seed rows only). */
export function isBuyableProduct(p: Product): boolean {
  return p.variants.length > 0;
}

/** True when at least one variant can be bought right now. */
export function productAvailable(p: Product): boolean {
  return p.variants.some((v) => v.available);
}

/** Lowest priced-variant price in cents, or null when unbuyable. */
export function productMinPriceCents(p: Product): number | null {
  if (p.variants.length === 0) return null;
  return Math.min(...p.variants.map((v) => v.price_cents));
}

/**
 * Highest compare-at price in cents, or null when no variant has one
 * (null today for every variant — callers must treat null as "no sale").
 */
export function productCompareAtCents(p: Product): number | null {
  const values = p.variants
    .map((v) => v.compare_at_price_cents)
    .filter((v): v is number => v !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

export interface ProductOptionGroup {
  /** D1 carries no option names, so groups are positional ("Option 1"...). */
  name: string;
  values: string[];
}

/**
 * Option pickers derived from variant positions: group i collects the
 * distinct option values at index i across all variants, in first-seen
 * order. Single-option products yield one group.
 */
export function productOptionGroups(p: Product): ProductOptionGroup[] {
  const maxOptions = p.variants.reduce(
    (max, v) => Math.max(max, v.options.length),
    0
  );
  const groups: ProductOptionGroup[] = [];
  for (let i = 0; i < maxOptions; i += 1) {
    const values: string[] = [];
    for (const v of p.variants) {
      const val = v.options[i];
      if (val !== undefined && !values.includes(val)) values.push(val);
    }
    groups.push({ name: `Option ${i + 1}`, values });
  }
  return groups;
}

/* --------------------------------- Fetching --------------------------------- */

async function getJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Catalog request failed (${res.status}) for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeVariant(v: ProductVariant): ProductVariant {
  return {
    title: v.title ?? "",
    options: Array.isArray(v.options) ? v.options : [],
    price_cents: v.price_cents,
    compare_at_price_cents: v.compare_at_price_cents ?? null,
    available: v.available === true,
  };
}

function normalizeProduct(p: Product): Product {
  return {
    handle: p.handle ?? "",
    title: p.title ?? "",
    vendor: p.vendor ?? "",
    description: p.description ?? "",
    image: p.image ?? "",
    images: Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : p.image
        ? [p.image]
        : [],
    collection_title: p.collection_title ?? "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    variants: Array.isArray(p.variants) ? p.variants.map(normalizeVariant) : [],
  };
}

function normalizeCollection(c: Collection): Collection {
  return {
    handle: c.handle ?? "",
    title: c.title ?? "",
    image: c.image ?? "",
    product_handles: Array.isArray(c.product_handles)
      ? c.product_handles
      : [],
  };
}

function normalizeCatalog(data: CatalogResponse): CatalogResponse {
  return {
    products: (data.products ?? []).map(normalizeProduct),
    collections: (data.collections ?? []).map(normalizeCollection),
  };
}

/**
 * Module-level cache for the single catalog call, matching the app's
 * existing refresh pattern: the store fetches on mount and on
 * pull-to-refresh (force), and screens filter the loaded catalog
 * locally instead of refetching per collection.
 */
let catalogCache: Promise<CatalogResponse> | null = null;

export function fetchCatalog(force = false): Promise<CatalogResponse> {
  if (!force && catalogCache) return catalogCache;
  catalogCache = getJson<CatalogResponse>(CATALOG_URL).then(normalizeCatalog);
  // A failed fetch must not poison the cache for the next retry.
  catalogCache.catch(() => {
    catalogCache = null;
  });
  return catalogCache;
}

/** Buyable products only — zero-variant products are excluded. */
export async function fetchProducts(): Promise<Product[]> {
  const data = await fetchCatalog();
  return data.products.filter(isBuyableProduct);
}

/** All collections from the catalog payload. */
export async function fetchCollections(): Promise<Collection[]> {
  const data = await fetchCatalog();
  return data.collections;
}

/**
 * Buyable products of one collection, in the collection's own
 * product_handles order. Filters the loaded catalog — no extra call.
 */
export async function fetchCollectionProducts(
  handle: string
): Promise<Product[]> {
  const data = await fetchCatalog();
  const collection = data.collections.find((c) => c.handle === handle);
  if (!collection) return [];
  const byHandle = new Map(data.products.map((p) => [p.handle, p]));
  return collection.product_handles
    .map((h) => byHandle.get(h))
    .filter((p): p is Product => p !== undefined && isBuyableProduct(p));
}
