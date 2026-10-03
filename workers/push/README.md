# BeaTrackFam push worker — deploy guide

This worker is the backend for app push notifications. It stores phone
tokens, sends broadcasts through Expo's free push service, and listens for
Shopify "new product" / "new collection" webhooks. Everything here is on
free tiers — nothing to pay.

The app never talks to Expo's push API directly and holds no secrets. The
only credential boundary is the worker URL, set as `PUSH_WORKER_URL` in
`lib/push.ts` (it's empty until you finish this guide — the app simply
doesn't register for pushes until then).

## 1. Cloudflare — create the worker (free)

1. Go to https://dash.cloudflare.com (same account as the reviews worker).
2. **Workers & Pages → Create Worker** → name it `beatrackfam-push` →
   Deploy → **Edit code** → delete everything there → paste the entire
   contents of `worker.js` → **Save and deploy**.

## 2. KV namespace (stores the phone tokens)

1. On the worker's page → **Bindings → Add binding → KV namespace**.
2. **Create new namespace** named `PUSH_KV` → bind it as variable name
   `PUSH_KV` → **Deploy** (or Save).

## 3. Secrets (never in code, never in chat)

On the worker's page → **Settings → Variables → Add variable**. For each
one, change the type from Text to **Secret**:

| Name | Value — where to get it |
|---|---|
| `PUSH_BROADCAST_SECRET` | Make one up: a long random string. On your Mac run `openssl rand -hex 32` and use the output. You need this to send manual broadcasts (maintenance notices etc.). |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify admin → **Settings → Notifications → Webhooks** — the signing secret shown at the bottom of that page. Copy it after you create the webhooks in step 6. |

**Save and redeploy** after adding the secrets (the worker picks them up on
the next deployment — hit **Deploy** again if it doesn't prompt you).

## 4. Point the app at the worker

1. Copy the worker's public URL from its Cloudflare page
   (looks like `https://beatrackfam-push.<you>.workers.dev`).
2. In the app repo, open `lib/push.ts` and set `PUSH_WORKER_URL` to that URL.
3. Rebuild the app. Until this is set, the app never asks for notification
   permission and registers nothing.

## 5. Android — free Firebase project (pushes need this)

Without this step, Android phones can't receive pushes (iPhones are
unaffected).

1. Go to https://console.firebase.google.com → **Add project** → name it
   `BeaTrackFam` → turn OFF Google Analytics (not needed) → Create.
2. On the project home, click the **Android** icon ("Add an app").
3. **Android package name:** `com.beatrackfaminc` (exactly — it's the app's
   package). App nickname anything you like. Skip the SHA-1.
4. **Download `google-services.json`** → put the file in the app's project
   root (next to `app.json`). That's it — EAS picks it up automatically at
   build time. No billing, no card, Firebase Cloud Messaging is free.

## 6. iOS — Apple push (APNs)

Nothing to do by hand. When you run the production build on your Mac,
EAS sets up the Apple push key automatically using your Apple Developer
account (the $99/yr one — no extra cost). Just be logged in with
`eas login` like before.

## 7. Shopify webhooks — AFTER the worker is deployed

This is what makes "New drop 🔥" notifications automatic.

1. Shopify admin → **Settings → Notifications** → scroll to **Webhooks** →
   **Create webhook**.
2. Webhook 1: Event **Product creation**, Format **JSON**, URL
   `https://beatrackfam-push.<you>.workers.dev/webhooks/products-create`
   (your real worker URL), API version: the latest. Save.
3. Webhook 2: same, but Event **Collection creation**, URL ending in
   `/webhooks/collections-create`. Save.
4. Copy the **signing secret** shown at the bottom of the Webhooks page
   into the worker's `SHOPIFY_WEBHOOK_SECRET` (step 3) and redeploy.
5. Shopify sends a test ping on save — the worker answers it, nothing is
   broadcast for the test.

Only **active** products trigger a broadcast (drafts stay quiet).

## 8. Sending a manual broadcast (maintenance, announcements)

From your Mac:

```bash
curl -X POST https://beatrackfam-push.<you>.workers.dev/broadcast \
  -H "Content-Type: application/json" \
  -H "X-Broadcast-Secret: YOUR_PUSH_BROADCAST_SECRET" \
  -d '{"title":"BeaTrackFam","body":"The app will be down for maintenance tonight at 2 AM.","data":{"type":"announcement"}}'
```

`data` is optional. To deep-link somewhere, use
`{"type":"product","id":"<numeric product id>"}` or
`{"type":"collection","id":"<collection handle>"}`.

## 9. Test it

1. Rebuild/install the app with `PUSH_WORKER_URL` set → accept the
   notification permission → open a product (this triggers registration).
2. Send the curl broadcast from step 8 → the phone should get it, even
   with the app closed. Tapping it opens the app (deep-links when `data`
   says so).
3. In Shopify, create a **draft** product → no notification. Mark it
   **active** → still no notification (webhook only fires on creation).
   Create a brand-new active product → "New drop 🔥" goes out.

## Limits (all free-tier comfortable)

- Expo push service: free, generous limits for a store this size.
- Cloudflare Workers free tier: 100k requests/day — pushes are a trickle.
- Broadcasts are rate-limited to 20/day (prevents accidents).
- Dead tokens (app uninstalled) are dropped automatically via Expo receipts.

## Alternative: wrangler deploy (instead of the dashboard)

```bash
cd workers/push
npx wrangler kv:namespace create PUSH_KV   # paste the id into wrangler.toml
npx wrangler deploy
npx wrangler secret put PUSH_BROADCAST_SECRET
npx wrangler secret put SHOPIFY_WEBHOOK_SECRET
```
