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
   - Secret `APP_SECRET` = the same shared worker secret (in
     `lib/resetConfig.ts`; never type it in chat).
   - Secret `SHOPIFY_STOREFRONT_TOKEN` = the token in `lib/storefront.ts`.
   - Secret `SHOPIFY_ADMIN_TOKEN` = from step 2 below.
   - Secret `STRIPE_SECRET_KEY` = from step 3 below (sk_test_ first!).
   - Secret `STRIPE_WEBHOOK_SECRET` = from step 4 below.
5. Check: open `https://beatrackfam-checkout.contact-beatrackfam.workers.dev/health`
   — every `configured` flag should be `true`.

## 2. Shopify custom app (Admin API token)
1. Shopify admin → **Settings → Apps and sales channels → Develop apps**
   → **Create an app** → name: `BeaTrackFam App Checkout`.
2. **Configuration → Admin API integration** → check `write_orders`
   (and `read_orders`) → Save.
3. **Install app** → **API credentials** → reveal the Admin API access
   token (`shpat_…`) → that's `SHOPIFY_ADMIN_TOKEN` above.
   This token lives ONLY in the worker secret — never in the app.

## 3. Stripe
1. Create the account at stripe.com (business: BeaTrackFam; have EIN +
   bank details ready). No cost until real sales come in.
2. **Developers → API keys** → copy the **Publishable key** (`pk_test_`
   first) into `lib/checkoutConfig.ts` in the app, and the **Secret
   key** (`sk_test_…`) into the worker as `STRIPE_SECRET_KEY`.
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

## 5. Ship + test
1. Gabi cuts a release with the publishable key in place → build it.
2. Place a TEST order in the app with Stripe's test card
   `4242 4242 4242 4242`, any future date + CVC. Also try the decline
   card `4000 0000 0000 0002` — the app must show Stripe's error and
   create NO order.
3. Confirm in Shopify admin: a paid order tagged `app-checkout` with
   the Stripe payment id in the note, totals matching, and Printify
   receiving it. (Cancel/refund that test order in admin after.)
4. When it all checks out: swap `sk_test_`/`pk_test_` for the live
   keys (Stripe → activate account first), redeploy the worker secret
   + ship a build with the live publishable key.

## Limits (by design)
- Shop Pay can't run outside Shopify's own checkout — it stays
  available on the website checkout only.
- PayPal needs its own integration later (Stripe doesn't process it).
- Refunds on app orders: refund in Stripe (money) — Shopify shows the
  order as paid via an external payment note (the Stripe id is in the
  order note + tagged `app-checkout`).
