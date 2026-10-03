# Forgot-password setup for Joey

The app now has a real "Forgot password?" flow: enter email → get a 6-digit
code by email → enter the code → set a new password. It stays hidden until
you complete this one-time setup — then it just works. Everything is free.

## Step 1 — Resend (sends the emails)

1. Go to https://resend.com and sign up (free tier is plenty).
2. Click **Domains** → **Add Domain** → type `beatrackfam.info`.
3. Resend will show you 3 DNS records (SPF + two DKIM records). Add them as
   TXT records where your domain's DNS is managed (wherever you manage
   beatrackfam.info), then go back to Resend and click **Verify**.
4. Click **API Keys** → **Create API Key** → name it `beatrackfam-app` →
   **copy the key** (it starts with `re_`). You only get to see it once —
   but don't worry, you can always create another one.

## Step 2 — Cloudflare (runs the reset code)

1. Go to https://dash.cloudflare.com/sign-up and sign up (free tier).
2. **Workers & Pages** → **Create** → **Create Worker** → give it a name like
   `beatrackfam-password-reset` → **Deploy**.
3. Click **Edit code** → delete everything there → paste the whole contents of
   `workers/password-reset/worker.js` from this project → **Save and deploy**.
4. On the worker's page: **Bindings** → **Add** → **KV namespace** →
   **Create a namespace** named `RESET_KV` → **Add** (the variable name must
   also be `RESET_KV`).
5. **Settings** → **Variables and Secrets** → add two **Secret** variables:
   - `RESEND_API_KEY` → your key from Step 1 (`re_...`)
   - `APP_SECRET` → `64c3b8d5f0489d98f890976b38afb14269fa9f3248001293`
6. Go back to the worker's main page and **copy its URL** — it looks like
   `https://beatrackfam-password-reset.YOUR-NAME.workers.dev`.

## Step 3 — Connect the app

1. Open `lib/resetConfig.ts` in this project.
2. Replace `"PASTE_WORKER_URL_HERE"` with the worker URL from Step 2.6.
3. Rebuild the app (it needs a fresh build on your Mac — same as any native
   change).

## Step 4 — Test it

1. Make an account in the app with an email you can read.
2. Log out → tap **Forgot password?** on the login screen.
3. Enter your email → you should get a branded email with a 6-digit code
   (check spam the first time).
4. Enter the code, set a new password, log in with it.

Note: until your domain is verified in Resend, test emails only reach the
address on your own Resend account — totally fine for testing.

## What the worker does

- `POST /request-code` — emails a 6-digit code, valid 10 minutes.
- `POST /verify-code` — checks the code, returns a one-time reset token.
- `POST /confirm-reset` — burns the token; the app then sets the new password.

Codes are stored hashed, single-use, and 5 wrong guesses burn a code.
Rate-limited: 5 requests/hour per email, 20/hour per IP.

## One honest limitation

Accounts currently live only on the phone they're created on, so this reset
changes the password for an account that still exists on that phone. It can't
bring an account back after the app's data is erased or on a different phone.
The planned Shopify login rebuild will fix that properly.
