/**
 * Shopify Storefront API (GraphQL) — native in-app checkout support.
 *
 * Creates a real Shopify cart and attaches the buyer's contact + shipping
 * details, so the native checkout sheet opens with everything pre-filled
 * and the buyer only has to pay. Payment is still processed by Shopify
 * (PCI-safe) — the app never sees card numbers.
 *
 * ── ONE-TIME SETUP (free, ~2 minutes, done by Joey in Shopify admin) ──
 * 1. Shopify admin → Settings → Apps and sales channels → Develop apps
 * 2. "Create an app" → name it e.g. "BeaTrackFam App"
 * 3. Configuration → Storefront API → enable these unauthenticated scopes:
 *      • unauthenticated_read_carts
 *      • unauthenticated_write_carts
 * 4. Install the app → API credentials → reveal the Storefront API
 *    access token and paste it into STOREFRONT_ACCESS_TOKEN below.
 *
 * Until the token is set, checkout still works — it just opens Shopify's
 * checkout in the browser (via cart permalink) instead of pre-filling.
 */
import { STOREFRONT_DOMAIN } from "./shopify";

/** Paste the Storefront API access token here (see setup steps above). */
export const STOREFRONT_ACCESS_TOKEN = "d9bdcfb406b5445f71f3a2608a76e596";

const STOREFRONT_API_VERSION = "2025-10";
const STOREFRONT_URL = `https://${STOREFRONT_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`;

/** Contact + shipping details collected in the app's checkout form. */
export interface CheckoutBuyer {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  /** Two-letter state/province code, e.g. "NY", "ON". */
  provinceCode: string;
  zip: string;
  /** ISO country code: "US", "CA", "MX". */
  countryCode: string;
}

export interface CartLineInput {
  /** Numeric variant id (as used by cart permalinks). */
  variantId: string;
  quantity: number;
}

export function isStorefrontConfigured(): boolean {
  return STOREFRONT_ACCESS_TOKEN.trim().length > 10;
}

/* ------------------------- Product gallery media ------------------------- */

const PRODUCT_MEDIA_QUERY = `
  query ProductMedia($id: ID!) {
    product(id: $id) {
      images(first: 20) {
        edges {
          node {
            url
            altText
            width
            height
          }
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            image {
              url
              altText
              width
              height
            }
          }
        }
      }
    }
  }
`;

interface ProductMediaImageNode {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

interface ProductMediaResponse {
  data?: {
    product?: {
      images?: { edges: { node: ProductMediaImageNode }[] };
      variants?: {
        edges: { node: { id: string; image: ProductMediaImageNode | null } }[];
      };
    } | null;
  };
  errors?: { message: string }[];
}

export interface ProductMedia {
  /** All product images (authoritative, includes variant-linked ones). */
  images: {
    url: string;
    altText: string | null;
    width: number;
    height: number;
  }[];
  /**
   * Variant image lookup: numeric variant id ("123456789")
   * -> that variant's image URL (or null when it has none).
   */
  variantImageById: Record<string, string | null>;
}

function gidTail(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
}

/**
 * Fetches a product's full image list plus each variant's linked image via
 * the Storefront GraphQL API. Throws on network/Shopify errors — callers
 * should fall back to the cached products.json images array.
 */
export async function fetchProductMedia(
  productNumericId: string
): Promise<ProductMedia> {
  if (!isStorefrontConfigured()) {
    throw new Error("Storefront API token is not configured.");
  }
  let res: Response;
  try {
    res = await fetch(STOREFRONT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_ACCESS_TOKEN.trim(),
      },
      body: JSON.stringify({
        query: PRODUCT_MEDIA_QUERY,
        variables: { id: `gid://shopify/Product/${productNumericId}` },
      }),
    });
  } catch (e) {
    throw new Error(
      `Couldn't reach Shopify (${e instanceof Error ? e.message : "network error"}).`
    );
  }
  if (!res.ok) {
    throw new Error(`Shopify returned an error (${res.status}).`);
  }
  const json = (await res.json()) as ProductMediaResponse;
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  const product = json.data?.product;
  if (!product) {
    throw new Error("Shopify didn't return the product.");
  }
  const images = (product.images?.edges ?? []).map((e) => ({
    url: e.node.url,
    altText: e.node.altText,
    width: e.node.width ?? 0,
    height: e.node.height ?? 0,
  }));
  const variantImageById: Record<string, string | null> = {};
  for (const edge of product.variants?.edges ?? []) {
    variantImageById[gidTail(edge.node.id)] = edge.node.image?.url ?? null;
  }
  return { images, variantImageById };
}

const CART_CREATE_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface CartCreateResponse {
  data?: {
    cartCreate?: {
      cart?: { id: string; checkoutUrl: string };
      userErrors?: { field: string[] | null; message: string }[];
    };
  };
  errors?: { message: string }[];
}

const NODES_QUERY = `
  query Nodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
      }
    }
  }
`;

/**
 * Returns the subset of the given variant ids (numeric tails) that no longer
 * exist in Shopify — e.g. a product was deleted and re-added under new ids
 * while an old cart line still points at the dead variant. Fails open: any
 * network/API problem returns an empty set so checkout is never blocked by
 * the validation call itself.
 */
export async function findDeadVariantIds(
  variantIds: string[]
): Promise<Set<string>> {
  const dead = new Set<string>();
  if (variantIds.length === 0 || !isStorefrontConfigured()) return dead;
  try {
    const gids = variantIds.map(
      (v) => `gid://shopify/ProductVariant/${v}`
    );
    const res = await fetch(STOREFRONT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_ACCESS_TOKEN.trim(),
      },
      body: JSON.stringify({ query: NODES_QUERY, variables: { ids: gids } }),
    });
    if (!res.ok) return dead;
    const json = (await res.json()) as {
      data?: { nodes?: ({ id: string } | null)[] };
      errors?: { message: string }[];
    };
    if (json.errors?.length || !json.data?.nodes) return dead;
    json.data.nodes.forEach((node, i) => {
      if (!node) dead.add(variantIds[i]);
    });
    return dead;
  } catch {
    return dead;
  }
}

/**
 * Creates a Shopify cart with the given lines and buyer identity, and
 * returns the checkout URL (with contact/shipping pre-filled).
 * Throws on network or Shopify errors.
 */
export async function createCartCheckoutUrl(
  lines: CartLineInput[],
  buyer: CheckoutBuyer,
  discountCodes: string[] = []
): Promise<string> {
  if (!isStorefrontConfigured()) {
    throw new Error("Storefront API token is not configured.");
  }

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
            // NOTE: MailingAddressInput uses `province` / `country`,
            // NOT `provinceCode` / `countryCode` (those don't exist here).
            province: buyer.provinceCode.trim().toUpperCase(),
            zip: buyer.zip,
            country: buyer.countryCode.trim().toUpperCase(),
            ...(buyer.phone ? { phone: buyer.phone } : {}),
          },
        },
      ],
    },
  };

  let res: Response;
  try {
    res = await fetch(STOREFRONT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_ACCESS_TOKEN.trim(),
      },
      body: JSON.stringify({
        query: CART_CREATE_MUTATION,
        variables: { input },
      }),
    });
  } catch (e) {
    throw new Error(
      `Couldn't reach Shopify (${e instanceof Error ? e.message : "network error"}).`
    );
  }

  if (!res.ok) {
    throw new Error(`Shopify returned an error (${res.status}).`);
  }

  const json = (await res.json()) as CartCreateResponse;
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  const result = json.data?.cartCreate;
  if (result?.userErrors?.length) {
    throw new Error(result.userErrors[0].message);
  }
  const checkoutUrl = result?.cart?.checkoutUrl;
  if (!checkoutUrl) {
    throw new Error("Shopify didn't return a checkout URL.");
  }
  return checkoutUrl;
}
