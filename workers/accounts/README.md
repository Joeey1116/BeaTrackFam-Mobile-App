# BeaTrackFam accounts worker — deploy guide

The account registry: customers can delete the app, reinstall later, and
**log in again with the same email** instead of signing up over and over.
Free tier. Takes about 5 minutes (same drill as the password-reset worker).

## Deploy (Cloudflare dashboard)

1. https://dash.cloudflare.com → **Workers & Pages → Create Worker** →
   name it exactly `beatrackfam-accounts` → Deploy.
2. **Edit code** → delete what's there → paste the entire contents of
   `worker.js` (this folder) → **Save and deploy**.
3. On the worker's page → **Bindings → Add binding → KV namespace** →
   create a new namespace named `ACCOUNTS_KV` → bind it with the variable
   name `ACCOUNTS_KV`.
4. **Settings → Variables and Secrets → Add** → type **Secret**, name
   `APP_SECRET`, value: the same app-secret value the password-reset
   worker uses (it's in `lib/resetConfig.ts` in the app repo — paste it
   from there; never type it in chat).
5. The worker URL will be
   `https://beatrackfam-accounts.contact-beatrackfam.workers.dev`
   (already filled into `lib/accountsConfig.ts` in the app — if your
   workers.dev subdomain differs, update that one line and re-run the
   app release).

## How the app uses it

- Sign up → account created on the phone AND registered here.
- Log in → checked here first; on a fresh install (no local account)
  the phone rebuilds its local copy from the login, so nothing else
  is needed. Offline? The phone falls back to its local account.
- Delete Account (Settings → Delete Account, password-confirmed) →
  the registry record is deleted too, so the email is free again —
  coming back means signing up fresh, exactly like before.
- Accounts created before this worker existed get registered
  automatically the next time their owner logs in on their phone.

## Endpoints (all POST JSON, `appSecret` in every body)

- `/register {name, email, password}`
- `/exists {email}`
- `/login {email, password}`
- `/delete {email, password}`
- `/change-password {email, oldPassword, newPassword}`
- `/sync-password {email, password}` (after the email-code reset flow)
