/**
 * Local app data.
 *
 * The live catalog (products/collections), cart checkout, and money
 * formatting now come from ../lib/shopify.ts — real BeaTrackFam store data.
 *
 * What is still local/placeholder here:
 * - INITIAL_CART / INITIAL_WISHLIST_IDS — the cart and wishlist start
 *   empty for a real shopper (previously preloaded with demo items).
 * - ORDERS / MOCK_USER — placeholders until Shopify's Customer Account
 *   API is wired for sign-in and order history.
 */

export * from "../lib/shopify";
import type { CartLine, Order, User } from "../lib/shopify";

/** A real shopper starts with an empty cart. */
export const INITIAL_CART: CartLine[] = [];

/** A real shopper starts with an empty wishlist. */
export const INITIAL_WISHLIST_IDS: string[] = [];

/** Placeholder orders — replaced by Customer Account API. */
export const ORDERS: Order[] = [
  {
    id: "gid://shopify/Order/1",
    name: "#1001",
    processedAt: "Sep 18, 2026",
    fulfillmentStatus: "DELIVERED",
    totalPrice: { amount: "56.85", currencyCode: "USD" },
    itemCount: 3,
  },
];

/** Placeholder user — replaced by Customer Account API sign-in. */
export const MOCK_USER: User = {
  firstName: "Guest",
  lastName: "Shopper",
  email: "",
};
