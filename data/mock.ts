/**
 * Local app data.
 *
 * The live catalog (products/collections), cart checkout, and money
 * formatting now come from ../lib/shopify.ts — the Cloudflare catalog
 * at GET https://beatrackfam.info/api/catalog (see that module).
 *
 * What is still local here:
 * - INITIAL_CART / INITIAL_WISHLIST_IDS — the cart and wishlist start
 *   empty for a real shopper.
 */

export * from "../lib/shopify";
import type { CartLine } from "../lib/shopify";

/** A real shopper starts with an empty cart. */
export const INITIAL_CART: CartLine[] = [];

/** A real shopper starts with an empty wishlist (product handles). */
export const INITIAL_WISHLIST_IDS: string[] = [];
