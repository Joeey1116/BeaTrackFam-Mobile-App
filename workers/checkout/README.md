# BeaTrackFam checkout worker — deploy guide

Powers full in-app checkout: the shopper pays inside the app (Stripe),
and only after the payment succeeds does this worker create the order
in Shopify, marked paid, so Printify fulfills it like any other order.
Promo codes are validated by Shopify at quote time — the same codes
from Shopify admin apply automatically. Free tiers everywhere; the
only cost is Stripe's normal processing fee on actual sales.

Deploy drill (~15 minutes total, same as the other workers):

## 1. Deploy the worker (Cloudflare)
1. https://dash.cloudflare.com → **Workers & Pages → Create Worker** →
   name it exactly `beatrackfam-checkout` → Deploy.
2. **Edit code** → delete what's there → paste all of `worker.js` →
   **Save and deploy**.
3. **Bindings → Add binding → KV namespace** → create `CHECKOUT_KV` →
   bind with variable name `CHECKOUT_KV`.
4. **Settings → Variables and Secrets**:
   - Variable `SHOPIFY_SHOP_DOMAIN` = your `….myshopify.com` domain
     (Shopify admin → Settings → Store details).
   - Variable `SHOPIFY_CLIENT_ID` = from step 2 below.
   - Secret `APP_SECRET` = the same shared worker secret (in
     `lib/resetConfig.ts`; never type it in chat).
   - Secret `SHOPIFY_STOREFRONT_TOKEN` = the token in `lib/storefront.ts`.
   - Secret `SHOPIFY_CLIENT_SECRET` = from step 2 below.
   - Secret `STRIPE_SECRET_KEY` = from step 3 below (sk_live_ — straight
     to live, no test mode).
   - Secret `STRIPE_WEBHOOK_SECRET` = from step 4 below.
5. Check: open `https://beatrackfam-checkout.contact-beatrackfam.workers.dev/health`
   — every `configured` flag should be `true`.

## 2. Shopify app (Dev Dashboard — Admin API access)
Use the **Dev Dashboard** route (leave the **Headless** app alone — it
powers the app's product feed / sales channel).
1. Shopify admin → **Settings → Apps and sales channels → Build apps**
   (opens the Dev Dashboard) → **Create app** → name:
   `BeaTrackFam App Checkout`.
2. **Configuration → Admin API integration** → check `write_orders`
   and `read_orders` → Save → create/release the version.
3. **Install** the app on your store.
4. **Settings → API credentials**: copy the **Client ID** (→ Cloudflare
   variable `SHOPIFY_CLIENT_ID`) and the **Client secret** (→ Cloudflare
   secret `SHOPIFY_CLIENT_SECRET`). The worker exchanges these for
   short-lived Admin tokens automatically and caches them in KV.
   (Legacy alternative: an admin custom app's `shpat_…` token can be set
   as `SHOPIFY_ADMIN_TOKEN` instead — the worker prefers it when present.)
   These credentials live ONLY in the worker — never in the app.

## 3. Stripe
1. Create the account at stripe.com (business: BeaTrackFam; have EIN +
   bank details ready). No cost until real sales come in.
2. **Developers → API keys** (LIVE mode — no test mode): send Gabi the
   **Publishable key** (`pk_live_…`, public by design — it goes in
   `lib/checkoutConfig.ts`), and put the **Secret key** (`sk_live_…`)
   into the worker as `STRIPE_SECRET_KEY` (never in chat).
3. In **Settings → Payments**, turn ON the methods you want: cards are
   on by default; enable Apple Pay / Google Pay domains are handled by
   the app SDK; Affirm / Afterpay / Klarna can be toggled here.
4. **Developers → Webhooks → Add endpoint**:
   URL `https://beatrackfam-checkout.contact-beatrackfam.workers.dev/webhook`,
   event `payment_intent.succeeded` → copy the signing secret
   (`whsec_…`) into the worker as `STRIPE_WEBHOOK_SECRET`.

## 4. Apple Pay (iOS)
1. Apple Developer → **Certificates, IDs & Profiles → Identifiers → +**
   → **Merchant IDs** → register `merchant.info.beatrackfam`
   (already set in the app's Stripe plugin config).
2. Open the app ID `com.beatrackfaminc` → enable **Apple Pay Payment
   Processing** → link the merchant ID.
3. Next iOS build picks it up automatically (signing syncs it).

## 5. Ship + verify (live, per Joey — no test mode)
1. Gabi cuts a release with the publishable key in place → build it.
2. Place one small REAL order on yourself in the app (cheapest item,
   real card). The payment should succeed in-app with no redirect.
3. Confirm in Shopify admin: a paid order tagged `app-checkout` with
   the Stripe payment id in the note, totals matching, and Printify
   receiving it.
4. Refund that order in Stripe + cancel it in Shopify admin right
   away (before Printify starts production). That's the full
   end-to-end proof — checkout is live.

## Limits (by design)
- Shop Pay can't run outside Shopify's own checkout — it stays
  available on the website checkout only.
- PayPal needs its own integration later (Stripe doesn't process it).
- Refunds on app orders: refund in Stripe (money) — Shopify shows the
  order as paid via an external payment note (the Stripe id is in the
  order note + tagged `app-checkout`).
