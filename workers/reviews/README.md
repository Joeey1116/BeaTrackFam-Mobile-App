# BeaTrackFam reviews worker — deploy guide

Lets shoppers read and write Judge.me product reviews inside the app,
without shipping any API tokens in the app bundle. Runs on Cloudflare's
free tier.

## What the worker does

| Endpoint | Purpose |
|---|---|
| `GET /reviews?productId=<n>&page=<n>&perPage=<n>` | Returns published reviews for one product + rating summary (average, count, 5→1 distribution). |
| `POST /submit-review` | Validates + rate-limits a review, then forwards it to Judge.me. |

## What Joey needs to do (about 15 minutes)

### 1. Get the Judge.me private API token — free
1. In Shopify admin → **Apps → Judge.me** → **Settings → Integrations →
   Developers → API** (or **General → API tokens**, depending on the
   Judge.me version you see).
2. Copy the **Private API token**. Keep it secret — it goes into the worker
   only, never into the app. (The public token is rejected by the reviews
   endpoint, so the app doesn't use any Judge.me token at all.)
3. While you're there: **make sure web reviews are enabled** (Judge.me
   ignores review submissions when web reviews are turned off).

### 2. Cloudflare (runs the code) — free
1. Sign up at https://dash.cloudflare.com/sign-up (skip if you already have
   the password-reset worker — same account).
2. **Workers & Pages → Create Worker** → name it e.g.
   `beatrackfam-reviews` → Deploy → **Edit code** → paste the entire
   contents of `worker.js` → **Save and deploy**.
3. **KV**: on the worker's page → **Bindings → Add binding → KV namespace** →
   **Create new namespace** named `REVIEWS_KV` → bind it as variable
   `REVIEWS_KV`.
4. **Secrets** (never pasted in code or chat): worker → **Settings →
   Variables → Add variable** → type **Secret**, name
   `JUDGEME_PRIVATE_TOKEN` → paste the private token from step 1.
   (Or: `npx wrangler secret put JUDGEME_PRIVATE_TOKEN` from this folder.)
5. Copy the worker's public URL (shown on its page, like
   `https://beatrackfam-reviews.<you>.workers.dev`).

### 3. Wrangler deploy (alternative to the dashboard)
```bash
cd workers/reviews
npx wrangler kv:namespace create REVIEWS_KV   # paste the id into wrangler.toml
npx wrangler secret put JUDGEME_PRIVATE_TOKEN
npx wrangler deploy
```

### 4. Point the app at the worker
In the app repo, open `lib/reviews.ts` and set `REVIEWS_WORKER_URL` to the
worker URL from step 2.5. That's the only credential boundary — the app
ships no Judge.me token (the reviews endpoint rejects the public token).

Until the worker URL is set, the reviews section stays completely hidden in
the app — no dead UI. Rebuild the app after editing.

### 5. Test it
1. Open any product in the app → scroll below the description → the
   **Reviews** section appears.
2. Submit a test review from the app → it should return "Thanks!" and show
   up in Judge.me admin (it may need approval first, depending on your
   Judge.me moderation settings).

## Limits & notes

- Reads pass `product_external_id` (the numeric Shopify product id) straight
  to Judge.me and pull up to 100 reviews per product for the rating summary
  — plenty for this store; raise `MAX_FETCH` in the worker if a product ever
  passes 100 reviews.
- `shop_domain` is hardcoded in the worker to the myshopify domain
  `rp4j61-zf.myshopify.com` — Judge.me rejects the custom domain with
  "Failed to authenticate".
- Rate limits: reads 60/hour per IP; writes 5/hour per IP and 3/hour per
  email (spam guard).
- Only published reviews (`hidden === false`) are returned; titles/bodies
  are HTML-stripped server-side (Judge.me's raw API is unsanitized).
- A submitted review goes through Judge.me's normal flow — it appears in
  the app once Judge.me publishes it (subject to your moderation settings).

## API shapes

`GET /reviews?productId=123&page=1&perPage=5` →
```json
{
  "ok": true,
  "summary": { "average": 4.7, "count": 12,
               "distribution": { "5": 9, "4": 2, "3": 1, "2": 0, "1": 0 } },
  "reviews": [
    { "id": 111, "title": "Great fit", "body": "...", "rating": 5,
      "reviewerName": "John S.", "verified": true,
      "createdAt": "2026-09-20T14:15:22Z" }
  ],
  "page": 1, "perPage": 5, "hasMore": true
}
```

`POST /submit-review`
`{ "productId": "123", "name": "Joey", "email": "joey@example.com",
   "rating": 5, "title": "Great fit", "body": "Love this shirt." }` →
`{ "ok": true }` (or `{ "ok": false, "error": "..." }`).

## Local dev (optional)

```bash
cd workers/reviews
npx wrangler dev
```
