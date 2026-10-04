/**
 * BeaTrackFam accounts worker (Cloudflare Workers, free tier).
 *
 * The account registry: this is what lets a customer delete the app,
 * reinstall it later, and simply LOG IN again with the same email —
 * instead of signing up from scratch. (Until this worker existed, app
 * accounts lived only in the phone's AsyncStorage and died with it.)
 *
 * Endpoints (all POST, JSON; every body carries `appSecret`):
 *   /register  { name, email, password }  -> { ok } | 409 if email taken
 *   /exists    { email }                  -> { ok, exists }
 *   /login     { email, password }        -> { ok, name } | 401
 *   /delete    { email, password }        -> { ok } | 401 (frees the email;
 *                                            the user signs up again to return)
 *   /change-password { email, oldPassword, newPassword } -> { ok } | 401
 *   /sync-password   { email, password }  -> { ok } (post-email-reset only;
 *                                            the reset worker's verified
 *                                            6-digit code flow is the proof,
 *                                            this just re-keys the registry)
 *
 * Secrets (dashboard or wrangler): APP_SECRET — the SAME value the
 * password-reset worker uses (it lives in the app bundle as an
 * abuse/quota guard; the real credential is the user's password).
 * KV binding: ACCOUNTS_KV (one `acct:<email>` record per account).
 *
 * Passwords are stored as salted SHA-256 hashes (per-account random
 * salt), the same scheme the app uses locally. Hashes are compared in
 * constant time. Profile extras (addresses, interests) stay on the
 * device; orders live in Shopify — this registry is identity only:
 * name + email + password hash.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (email) => String(email ?? "").trim().toLowerCase();
const keyFor = (email) => `acct:${email}`;

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison to avoid timing leaks. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function getAccount(env, email) {
  const raw = await env.ACCOUNTS_KV.get(keyFor(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function passwordMatches(account, password) {
  const attempt = await sha256Hex(`${account.salt}::${password}`);
  return timingSafeEqual(attempt, account.passwordHash);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({ ok: true });
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed." }, 405);
    }

    const url = new URL(request.url);
    const body = await readBody(request);

    if (!env.APP_SECRET || !timingSafeEqual(String(body.appSecret ?? ""), env.APP_SECRET)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const email = norm(body.email);
    if (!EMAIL_RE.test(email)) {
      return json({ ok: false, error: "Enter a valid email address." }, 400);
    }

    if (url.pathname === "/exists") {
      const account = await getAccount(env, email);
      return json({ ok: true, exists: Boolean(account) });
    }

    if (url.pathname === "/register") {
      const name = String(body.name ?? "").trim();
      const password = String(body.password ?? "");
      if (name.length < 2) {
        return json({ ok: false, error: "Enter your name." }, 400);
      }
      if (password.length < 6) {
        return json(
          { ok: false, error: "Choose a password with at least 6 characters." },
          400
        );
      }
      const existing = await getAccount(env, email);
      if (existing) {
        return json(
          { ok: false, error: "An account with this email already exists." },
          409
        );
      }
      const salt = randomHex(16);
      const record = {
        name,
        email,
        salt,
        passwordHash: await sha256Hex(`${salt}::${password}`),
        createdAt: new Date().toISOString(),
      };
      await env.ACCOUNTS_KV.put(keyFor(email), JSON.stringify(record));
      return json({ ok: true });
    }

    if (url.pathname === "/login") {
      const account = await getAccount(env, email);
      if (!account) {
        return json({ ok: false, error: "No account found with this email." }, 404);
      }
      const ok = await passwordMatches(account, String(body.password ?? ""));
      if (!ok) {
        return json({ ok: false, error: "Incorrect password." }, 401);
      }
      return json({ ok: true, name: account.name });
    }

    if (url.pathname === "/delete") {
      const account = await getAccount(env, email);
      if (!account) {
        // Already gone — deleting is idempotent.
        return json({ ok: true });
      }
      const ok = await passwordMatches(account, String(body.password ?? ""));
      if (!ok) {
        return json({ ok: false, error: "Incorrect password." }, 401);
      }
      await env.ACCOUNTS_KV.delete(keyFor(email));
      return json({ ok: true });
    }

    if (url.pathname === "/change-password") {
      const newPassword = String(body.newPassword ?? "");
      if (newPassword.length < 6) {
        return json(
          { ok: false, error: "Choose a password with at least 6 characters." },
          400
        );
      }
      const account = await getAccount(env, email);
      if (!account) {
        return json({ ok: false, error: "No account found with this email." }, 404);
      }
      const ok = await passwordMatches(account, String(body.oldPassword ?? ""));
      if (!ok) {
        return json({ ok: false, error: "Incorrect password." }, 401);
      }
      const salt = randomHex(16);
      account.salt = salt;
      account.passwordHash = await sha256Hex(`${salt}::${newPassword}`);
      await env.ACCOUNTS_KV.put(keyFor(email), JSON.stringify(account));
      return json({ ok: true });
    }

    if (url.pathname === "/sync-password") {
      // Called only after the password-reset worker verified the emailed
      // code and the app confirmed the reset. Re-keys the registry record
      // (creating it if the account predates the registry).
      const password = String(body.password ?? "");
      if (password.length < 6) {
        return json(
          { ok: false, error: "Choose a password with at least 6 characters." },
          400
        );
      }
      const account = (await getAccount(env, email)) ?? {
        name: email.split("@")[0],
        email,
        createdAt: new Date().toISOString(),
      };
      const salt = randomHex(16);
      account.salt = salt;
      account.passwordHash = await sha256Hex(`${salt}::${password}`);
      await env.ACCOUNTS_KV.put(keyFor(email), JSON.stringify(account));
      return json({ ok: true });
    }

    return json({ ok: false, error: "Not found." }, 404);
  },
};
