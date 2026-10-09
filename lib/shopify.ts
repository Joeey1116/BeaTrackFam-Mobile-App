/**
 * Shopify data layer — live BeaTrackFam catalog.
 *
 * The app reads the store's PUBLIC storefront JSON endpoints
 * (the same feeds every Shopify theme uses), so the catalog is always
 * Joey's real products, collections, images and prices — no API key
 * ships in the app and new products appear automatically.
 *
 * Future upgrade path: swap the fetch functions below for Storefront
 * API GraphQL (needs a storefront access token) to get cartCreate /
 * Customer Account API. The types already mirror Storefront shapes.
 */

export const STOREFRONT_DOMAIN = "beatrackfam.info";
const API_BASE = `https://${STOREFRONT_DOMAIN}`;

/* ---------------------------------- Types ---------------------------------- */

export interface MoneyV2 {
  amount: string; // decimal string, e.g. "19.71"
  currencyCode: string;
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface ProductVariant {
  /** Numeric REST variant id as a string — used for cart permalinks. */
  id: string;
  title: string; // e.g. "Black / S"
  price: MoneyV2;
  compareAtPrice: MoneyV2 | null;
  availableForSale: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

export interface ProductOption {
  name: string; // e.g. "Size"
  values: string[];
}

/** Shape mirrors Storefront API Product (trimmed). */
export interface Product {
  id: string; // gid://shopify/Product/<n>
  /** Numeric id tail — used as the /product/[id] route param. */
  numericId: string;
  title: string;
  handle: string;
  vendor: string;
  description: string;
  images: ShopifyImage[];
  variants: ProductVariant[];
  options: ProductOption[];
  /** Min available variant price — for cards/grids. */
  price: MoneyV2;
  compareAtPrice: MoneyV2 | null;
  availableForSale: boolean;
  /** ISO creation timestamp from Shopify (products.json `created_at`). */
  createdAt?: string;
}

/** Shape mirrors Storefront API Collection (trimmed). */
export interface Collection {
  id: string; // gid://shopify/Collection/<n>
  title: string;
  handle: string;
  image: ShopifyImage | null;
  productsCount: number;
}

export interface CartLine {
  id: string;
  product: Product;
  variantId: string;
  variantTitle: string;
  unitPrice: MoneyV2;
  quantity: number;
}

/** Placeholder until Customer Account API is wired. */
export interface Order {
  id: string;
  name: string;
  processedAt: string;
  fulfillmentStatus: "DELIVERED" | "IN_TRANSIT" | "PROCESSING";
  totalPrice: MoneyV2;
  itemCount: number;
}

/** Placeholder until Customer Account API is wired. */
export interface User {
  firstName: string;
  lastName: string;
  email: string;
}

export function formatMoney(m: MoneyV2): string {
  return `$${Number(m.amount).toFixed(2)}`;
}

/* --------------------------------- Fetching --------------------------------- */

async function getJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Shopify request failed (${res.status}) for ${path}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const usd = (amount: string): MoneyV2 => ({ amount, currencyCode: "USD" });

interface RestImage {
  src: string;
  alt?: string | null;
  width?: number;
  height?: number;
}

interface RestVariant {
  id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface RestProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  body_html: string;
  created_at?: string;
  images: RestImage[];
  variants: RestVariant[];
  options: { name: string; values: string[] }[];
}

function toImage(img: RestImage): ShopifyImage {
  return {
    url: img.src,
    altText: img.alt ?? null,
    width: img.width ?? 1024,
    height: img.height ?? 1024,
  };
}

function toVariant(v: RestVariant): ProductVariant {
  return {
    id: String(v.id),
    title: v.title,
    price: usd(v.price),
    compareAtPrice: v.compare_at_price ? usd(v.compare_at_price) : null,
    availableForSale: v.available,
    option1: v.option1,
    option2: v.option2,
    option3: v.option3,
  };
}

export function normalizeProduct(p: RestProduct): Product {
  const variants = p.variants.map(toVariant);
  const available = variants.filter((v) => v.availableForSale);
  const priced = (available.length > 0 ? available : variants).filter((v) =>
    Number.isFinite(Number(v.price.amount))
  );
  const minPrice = priced.reduce(
    (min, v) => (Number(v.price.amount) < Number(min.price.amount) ? v : min),
    priced[0] ?? toVariant(p.variants[0])
  );
  const anyAvailable = variants.some((v) => v.availableForSale);

  return {
    id: `gid://shopify/Product/${p.id}`,
    numericId: String(p.id),
    title: p.title,
    handle: p.handle,
    vendor: p.vendor || "BeaTrackFam",
    description: p.body_html ? stripHtml(p.body_html) : "",
    images: p.images.map(toImage),
    variants,
    options: (p.options ?? [])
      .filter((o) => o.name.toLowerCase() !== "title" || o.values.length > 1)
      .map((o) => ({ name: o.name, values: o.values })),
    price: minPrice.price,
    compareAtPrice: minPrice.compareAtPrice,
    availableForSale: anyAvailable,
    createdAt: p.created_at,
  };
}

interface RestCollection {
  id: number;
  title: string;
  handle: string;
  image: RestImage | null;
  products_count: number;
}

function normalizeCollection(c: RestCollection): Collection {
  return {
    id: `gid://shopify/Collection/${c.id}`,
    title: c.title,
    handle: c.handle,
    image: c.image ? toImage(c.image) : null,
    productsCount: c.products_count ?? 0,
  };
}

/** All live products (online-store channel). */
export async function fetchProducts(): Promise<Product[]> {
  const data = await getJson<{ products: RestProduct[] }>(
    "/products.json?limit=250"
  );
  return data.products.map(normalizeProduct);
}

/** All live collections. */
export async function fetchCollections(): Promise<Collection[]> {
  const data = await getJson<{ collections: RestCollection[] }>(
    "/collections.json?limit=250"
  );
  return data.collections.map(normalizeCollection);
}

/** Live products inside one collection. */
export async function fetchCollectionProducts(
  handle: string
): Promise<Product[]> {
  const data = await getJson<{ products: RestProduct[] }>(
    `/collections/${handle}/products.json?limit=250`
  );
  return data.products.map(normalizeProduct);
}

/* --------------------------------- Checkout --------------------------------- */

/**
 * Shopify cart permalink — opens the customer's real Shopify checkout
 * (Apple Pay / Google Pay / cards) with these exact variants preloaded.
 * No API token required.
 */
export function buildCartPermalink(lines: CartLine[]): string {
  const items = lines.map((l) => `${l.variantId}:${l.quantity}`).join(",");
  return `${API_BASE}/cart/${items}`;
}
