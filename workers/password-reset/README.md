# BeaTrackFam password-reset worker — deploy guide

Sends 6-digit password-reset codes via Resend. Runs on Cloudflare's free tier.

## What Joey needs to do (about 15 minutes)

### 1. Resend (sends the emails) — free
1. Sign up at https://resend.com
2. **Domains → Add Domain** → enter `beatrackfam.info`
3. Resend shows 3 DNS records (SPF, DKIM, DKIM 2). Add them as TXT records
   wherever `beatrackfam.info`'s DNS is managed, then click Verify in Resend.
4. **API Keys → Create API Key** → name it `beatrackfam-app` → copy the key
   (starts with `re_`). You only see it once.

### 2. Cloudflare (runs the code) — free
1. Sign up at https://dash.cloudflare.com/sign-up
2. **Workers & Pages → Create Worker** → name it e.g.
   `beatrackfam-password-reset` → Deploy → **Edit code** → paste the entire
   contents of `worker.js` → **Save and deploy**.
3. **KV**: on the worker's page → **Bindings → Add binding → KV namespace** →
   **Create new namespace** named `RESET_KV` → bind it as variable `RESET_KV`.
4. **Secrets** (never pasted in code or chat):
   - `npx wrangler secret put RESEND_API_KEY` → paste the `re_...` key, **or**
     in the dashboard: worker → **Settings → Variables → Add variable** →
     type **Secret**, name `RESEND_API_KEY`.
   - Same for `APP_SECRET`, value:
     `64c3b8d5f0489d98f890976b38afb14269fa9f3248001293`
     (matches `lib/resetConfig.ts` in the app).
5. Copy the worker's public URL (shown on its page, like
   `https://beatrackfam-password-reset.<you>.workers.dev`).

### 3. Point the app at the worker
In the app repo, open `lib/resetConfig.ts` and replace
`"PASTE_WORKER_URL_HERE"` with the worker URL from step 2.5. Rebuild the app.

### 4. Test it
1. In the app, create an account with an email you can read.
2. Log out → **Log In → Forgot password?** → enter the email.
3. You get a branded email with a 6-digit code (check spam the first time).
4. Enter the code → set a new password → log in with it.

Until your domain is verified in Resend, test emails can only go to the
address on your own Resend account — that's fine for testing.

## API

All `POST`, JSON bodies, always include `appSecret` (the APP_SECRET value).

| Endpoint | Body | Result |
|---|---|---|
| `/request-code` | `{ email, appSecret }` | `{ ok: true }` — emails the code |
| `/verify-code` | `{ email, code, appSecret }` | `{ ok: true, resetToken }` |
| `/confirm-reset` | `{ email, resetToken, appSecret }` | `{ ok: true }` — single use |

Codes: 6 digits, SHA-256 hashed in KV, 10-minute TTL, single-use, 5 wrong
attempts burns the code. Rate limits: 5 code requests/hour per email,
20/hour per IP.

## Local dev (optional)

```bash
cd workers/password-reset
npx wrangler dev
```
