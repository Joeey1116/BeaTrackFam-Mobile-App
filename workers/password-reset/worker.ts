/**
 * BeaTrackFam password-reset worker (Cloudflare Workers, free tier).
 *
 * Endpoints (all POST, JSON):
 *   /request-code   { email, appSecret }            -> emails a 6-digit code
 *   /verify-code    { email, code, appSecret }      -> { ok, resetToken }
 *   /confirm-reset  { email, resetToken, appSecret } -> { ok } (single use)
 *
 * Secrets (wrangler secret put): RESEND_API_KEY, APP_SECRET
 * KV binding: RESET_KV
 *
 * Security notes:
 * - APP_SECRET is a quota/abuse guard, not a true secret: it lives in the
 *   app bundle and can be extracted. The real auth factor is the code, which
 *   is delivered to the user's email inbox and verified server-side.
 * - Codes are stored as SHA-256 hashes with a 10-minute TTL and are
 *   single-use; 5 wrong attempts invalidates the code.
 * - Reset tokens are single-use with a 10-minute TTL.
 * - Basic per-email / per-IP rate limiting on /request-code.
 */

interface Env {
  RESET_KV: KVNamespace;
  RESEND_API_KEY: string;
  APP_SECRET: string;
  /** e.g. "BeaTrackFam <noreply@beatrackfam.info>" — must be a verified Resend domain. */
  FROM_EMAIL?: string;
}

const CODE_TTL = 600; // 10 minutes
const TOKEN_TTL = 600;
const MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (email: string) => email.trim().toLowerCase();

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to avoid timing leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomCode(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const n = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  return String(n % 1000000).padStart(6, "0");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

function emailHtml(code: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="background:#000000;border-radius:16px 16px 0 0;padding:24px;text-align:center;">
      <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px;">BEATRACKFAM</div>
      <div style="color:#bbbbbb;font-size:12px;letter-spacing:3px;margin-top:4px;">LOYALTY ABOVE ALL</div>
    </div>
    <div style="background:#ffffff;border-radius:0 0 16px 16px;padding:32px 24px;text-align:center;">
      <p style="color:#333;font-size:15px;margin:0 0 8px;">Your password reset code is:</p>
      <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#000;margin:16px 0;">${code}</div>
      <p style="color:#777;font-size:13px;margin:0 0 4px;">It expires in 10 minutes.</p>
      <p style="color:#999;font-size:12px;margin:0;">If you didn't ask for this, you can ignore this email.</p>
    </div>
  </div>
</body></html>`;
}

async function sendCodeEmail(env: Env, to: string, code: string): Promise<boolean> {
  const from = env.FROM_EMAIL || "BeaTrackFam <noreply@beatrackfam.info>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your BeaTrackFam password reset code",
      html: emailHtml(code),
      text: `Your BeaTrackFam password reset code is: ${code}. It expires in 10 minutes. If you didn't ask for this, ignore this email.`,
    }),
  });
  return res.ok;
}

async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  const count = Number((await kv.get(key)) ?? 0);
  if (count >= max) return false;
  await kv.put(key, String(count + 1), { expirationTtl: windowSec });
  return true;
}

async function handleRequestCode(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    appSecret?: string;
  };
  const email = norm(body.email ?? "");
  // Always return ok-shaped responses; never reveal whether an email exists.
  if (!timingSafeEqual(body.appSecret ?? "", env.APP_SECRET)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for") ??
    "unknown";
  const emailOk = await checkRateLimit(env.RESET_KV, `rl:email:${email}`, 5, 3600);
  const ipOk = await checkRateLimit(env.RESET_KV, `rl:ip:${ip}`, 20, 3600);
  if (!emailOk || !ipOk) {
    return json(
      { ok: false, error: "Too many requests. Try again later." },
      429
    );
  }

  const code = randomCode();
  const hash = await sha256Hex(`${email}:${code}`);
  await env.RESET_KV.put(
    `code:${email}`,
    JSON.stringify({ hash, attempts: 0 }),
    { expirationTtl: CODE_TTL }
  );
  const sent = await sendCodeEmail(env, email, code);
  if (!sent) {
    await env.RESET_KV.delete(`code:${email}`);
    return json(
      { ok: false, error: "Couldn't send the email. Try again in a bit." },
      502
    );
  }
  return json({ ok: true });
}

async function handleVerifyCode(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
    appSecret?: string;
  };
  const email = norm(body.email ?? "");
  const code = (body.code ?? "").trim();
  if (!timingSafeEqual(body.appSecret ?? "", env.APP_SECRET)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }
  if (!/^\d{6}$/.test(code)) {
    return json({ ok: false, error: "Enter the 6-digit code." }, 400);
  }
  const raw = await env.RESET_KV.get(`code:${email}`);
  if (!raw) {
    return json(
      { ok: false, error: "That code expired. Request a new one." },
      400
    );
  }
  const record = JSON.parse(raw) as { hash: string; attempts: number };
  if (record.attempts >= MAX_ATTEMPTS) {
    await env.RESET_KV.delete(`code:${email}`);
    return json(
      { ok: false, error: "Too many wrong attempts. Request a new code." },
      400
    );
  }
  const hash = await sha256Hex(`${email}:${code}`);
  if (!timingSafeEqual(hash, record.hash)) {
    record.attempts += 1;
    if (record.attempts >= MAX_ATTEMPTS) {
      await env.RESET_KV.delete(`code:${email}`);
    } else {
      await env.RESET_KV.put(`code:${email}`, JSON.stringify(record), {
        expirationTtl: CODE_TTL,
      });
    }
    return json({ ok: false, error: "That code isn't right. Try again." }, 400);
  }
  // Code is correct — single use.
  await env.RESET_KV.delete(`code:${email}`);
  const resetToken = randomToken();
  await env.RESET_KV.put(`token:${resetToken}`, email, {
    expirationTtl: TOKEN_TTL,
  });
  return json({ ok: true, resetToken });
}

async function handleConfirmReset(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    resetToken?: string;
    appSecret?: string;
  };
  const email = norm(body.email ?? "");
  const token = (body.resetToken ?? "").trim();
  if (!timingSafeEqual(body.appSecret ?? "", env.APP_SECRET)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }
  if (!token) return json({ ok: false, error: "Missing reset token." }, 400);
  const storedEmail = await env.RESET_KV.get(`token:${token}`);
  if (!storedEmail || storedEmail !== email) {
    return json(
      { ok: false, error: "This reset link expired. Start over." },
      400
    );
  }
  // Single use.
  await env.RESET_KV.delete(`token:${token}`);
  return json({ ok: true });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }
    if (req.method !== "POST") {
      return json({ ok: false, error: "Method not allowed." }, 405);
    }
    const url = new URL(req.url);
    switch (url.pathname) {
      case "/request-code":
        return handleRequestCode(req, env);
      case "/verify-code":
        return handleVerifyCode(req, env);
      case "/confirm-reset":
        return handleConfirmReset(req, env);
      default:
        return json({ ok: false, error: "Not found." }, 404);
    }
  },
};
