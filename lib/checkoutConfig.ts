/**
 * Config for full in-app checkout (Stripe PaymentSheet + the
 * BeaTrackFam Cloudflare storefront backend).
 *
 * HOW IT WORKS
 * The shopper pays inside the app (card, Apple Pay, Google Pay, and
 * Affirm/Afterpay/Klarna when enabled on the Stripe account) against a
 * PaymentIntent created by the site backend
 * (POST /api/checkout/create-embedded-intent). The backend creates the
 * site order (pending_payment) at intent time — that is the store's
 * standing rule — and its Stripe webhook flips the order to paid once
 * the money lands, so Printify fulfills it like any other order.
 *
 * There is NO app test-mode concept on the site backend: Stripe
 * test/live is a server-side posture, not something the app can flip
 * per device. The old owner-only test switch (separate test worker +
 * test publishable key) was removed with the Shopify checkout worker
 * because it cannot point at the site's own test posture without new
 * backend work. Checkout here is always the live site backend.
 *
 * Apple Pay: merchant ID merchant.com.beatrackfaminc (plugin is
 * configured with it in app.json); see the rebuild plan for the
 * remaining dashboard checks (Payment Processing Certificate in the
 * Stripe Dashboard is the most likely gap).
 */

/** The Cloudflare storefront backend — every site API lives here. */
export const SITE_BACKEND_URL = "https://beatrackfam.info";

/** Stripe PUBLISHABLE key (pk_live_…). Safe to ship in-app. */
export const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51SnaQ5Q3FeSPQRlUNFJdLAk3eJIvXrfI8bgZMyqy5igTzec83oIutk4Zb1JW4VrK855divpbDQHV4L1Tn2luttSd00zOfk0l4j";

/** Apple Merchant ID for Apple Pay (created in the Apple Developer portal). */
export const APPLE_MERCHANT_ID = "merchant.com.beatrackfaminc";

export const isStripeKeyTest = () =>
  STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_");

export const isInAppCheckoutEnabled = () =>
  STRIPE_PUBLISHABLE_KEY.trim().length > 10 &&
  SITE_BACKEND_URL.trim().length > 0;

/**
 * The native Stripe SDK wants a syntactically valid key at startup even
 * before setup; this placeholder is never used to charge anything —
 * payment UI only opens when isInAppCheckoutEnabled() is true.
 */
export const stripeProviderKey = () =>
  isInAppCheckoutEnabled()
    ? STRIPE_PUBLISHABLE_KEY.trim()
    : "pk_test_not_configured";
