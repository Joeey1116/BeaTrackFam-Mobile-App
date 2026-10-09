/**
 * Config for full in-app checkout (Stripe PaymentSheet + checkout worker).
 *
 * HOW IT WORKS
 * The shopper pays inside the app (card, Apple Pay, Google Pay, and
 * Affirm/Afterpay/Klarna when enabled on the Stripe account). Only AFTER
 * the payment succeeds does the checkout worker create the order in
 * Shopify, marked paid, so Printify fulfills it like any other order.
 * Promo codes are validated by Shopify at quote time, so codes created
 * in Shopify admin apply exactly like on the website.
 *
 * SETUP (one-time, see workers/checkout/README.md for the full guide)
 * 1. Create a Stripe account → paste the PUBLISHABLE key below.
 * 2. Deploy workers/checkout (Cloudflare) → its URL is already filled in.
 * 3. Create an Apple Merchant ID `merchant.info.beatrackfam` (plugin is
 *    already configured with it in app.json) and associate it with the
 *    app in the Apple Developer portal → Apple Pay turns on.
 *
 * Until the publishable key is pasted, in-app checkout is OFF and the
 * app keeps using today's Shopify checkout (browser / native sheet),
 * so nothing breaks before setup is finished. The shared worker guard
 * lives in lib/accountsConfig.ts; the checkout client reads it there.
 */

/** Stripe PUBLISHABLE key (pk_live_… or pk_test_…). Safe to ship in-app. */
export const STRIPE_PUBLISHABLE_KEY = "";

/** Apple Merchant ID for Apple Pay (created in the Apple Developer portal). */
export const APPLE_MERCHANT_ID = "merchant.info.beatrackfam";

export const CHECKOUT_WORKER_URL =
  "https://beatrackfam-checkout.contact-beatrackfam.workers.dev";

export const isStripeKeyTest = () =>
  STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_");

export const isInAppCheckoutEnabled = () =>
  STRIPE_PUBLISHABLE_KEY.trim().length > 10 &&
  CHECKOUT_WORKER_URL.trim().length > 0;

/**
 * The native Stripe SDK wants a syntactically valid key at startup even
 * before setup; this placeholder is never used to charge anything —
 * payment UI only opens when isInAppCheckoutEnabled() is true.
 */
export const stripeProviderKey = () =>
  isInAppCheckoutEnabled()
    ? STRIPE_PUBLISHABLE_KEY.trim()
    : "pk_test_not_configured";
