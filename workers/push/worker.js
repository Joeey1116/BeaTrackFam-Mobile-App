/**
 * beatrackfam-push — push notification backend for the BeaTrackFam app.
 *
 * Plain JS, deployed by pasting into the Cloudflare dashboard
 * (Workers & Pages → Create Worker → Edit code). See README.md.
 *
 * Endpoints:
 *   GET  /                                  health check
 *   POST /register                          {token, platform} → store in KV
 *   POST /unregister                        {token} → remove from KV
 *   POST /broadcast                         {title, body, data?} → all tokens
 *        guarded by the PUSH_BROADCAST_SECRET header (X-Broadcast-Secret)
 *   POST /webhooks/products-create          Shopify "Product creation" webhook
 *   POST /webhooks/collections-create       Shopify "Collection creation" webhook
 *        both verified with SHOPIFY_WEBHOOK_SECRET (HMAC-SHA256)
 *
 * Secrets (all via Settings → Variables → Secret, NEVER in code):
 *   PUSH_BROADCAST_SECRET   shared secret for manual broadcasts
 *   SHOPIFY_WEBHOOK_SECRET  signing secret from Shopify admin → Settings →
 *                           Notifications → Webhooks (bottom of the page)
 * KV binding:
 *   PUSH_KV                 token store + rate limits
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const CHUNK_SIZE = 100; // Expo's max messages per /push/send call

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, X-Broadcast-Secret",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

/** Constant-time string compare (for the broadcast secret). */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function isValidExpoToken(token) {
  return (
    typeof token === "string" && /^ExponentPushToken\[[^\]]+\]$/.test(token)
  );
}

async function checkRateLimit(kv, key, max, windowSec) {
  const count = Number((await kv.get(key)) ?? 0);
  if (count >= max) return false;
  await kv.put(key, String(count + 1), { expirationTtl: windowSec });
  return true;
}

function clientIp(req) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for") ??
    "unknown"
  );
}

/* ------------------------------- token store ------------------------------ */

async function listTokens(env) {
  const tokens = [];
  let cursor;
  do {
    const page = await env.PUSH_KV.list({ prefix: "token:", cursor });
    for (const k of page.keys) {
      try {
        const v = await env.PUSH_KV.get(k.name, "json");
        if (v && isValidExpoToken(v.token)) tokens.push(v.token);
      } catch {
        // A single bad record never breaks the listing.
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return tokens;
}

async function handleRegister(req, env) {
  const ok = await checkRateLimit(
    env.PUSH_KV,
    `rl:register:${clientIp(req)}`,
    60,
    3600
  );
  if (!ok) return json({ ok: false, error: "Too many requests." }, 429);

  const { token, platform } = await req.json().catch(() => ({}));
  if (!isValidExpoToken(token)) {
    return json({ ok: false, error: "Invalid push token." }, 400);
  }
  if (platform !== "ios" && platform !== "android") {
    return json({ ok: false, error: "Invalid platform." }, 400);
  }
  await env.PUSH_KV.put(
    `token:${token}`,
    JSON.stringify({ token, platform, updatedAt: Date.now() })
  );
  return json({ ok: true });
}

async function handleUnregister(req, env) {
  const { token } = await req.json().catch(() => ({}));
  if (typeof token === "string" && token.length > 0) {
    await env.PUSH_KV.delete(`token:${token}`);
  }
  return json({ ok: true });
}

/* ------------------------------ Expo fan-out ------------------------------ */

/**
 * Sends one chunk (<=100 messages). Returns the tokens Expo says are dead
 * (DeviceNotRegistered), checked both in the immediate response and in the
 * delivery receipts.
 */
async function sendChunk(messages) {
  const dead = new Set();
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });
  const data = await res.json().catch(() => ({}));
  const tickets = Array.isArray(data.data) ? data.data : [];

  const idToToken = {};
  const receiptIds = [];
  tickets.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    if (t.status === "ok" && t.id) {
      receiptIds.push(t.id);
      idToToken[t.id] = messages[i].to;
    } else if (
      t.status === "error" &&
      t.details &&
      t.details.error === "DeviceNotRegistered"
    ) {
      dead.add(messages[i].to);
    }
  });

  // Delivery receipts are best-effort — a failure here never fails the send.
  if (receiptIds.length > 0) {
    try {
      const rres = await fetch(EXPO_RECEIPTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify({ ids: receiptIds }),
      });
      const rdata = await rres.json().catch(() => ({}));
      const receipts =
        rdata && typeof rdata.data === "object" ? rdata.data : {};
      for (const [rid, r] of Object.entries(receipts)) {
        if (
          r &&
          r.status === "error" &&
          r.details &&
          r.details.error === "DeviceNotRegistered" &&
          idToToken[rid]
        ) {
          dead.add(idToToken[rid]);
        }
      }
    } catch {
      // ignore
    }
  }
  return [...dead];
}

/** Broadcasts to every registered token, dropping dead ones. */
async function broadcast(env, title, body, data) {
  const tokens = await listTokens(env);
  if (tokens.length === 0) return { sent: 0, devices: 0, dropped: 0 };

  const cleanTitle = String(title ?? "").slice(0, 120);
  const cleanBody = String(body ?? "").slice(0, 240);
  const cleanData =
    data && typeof data === "object" && !Array.isArray(data) ? data : {};

  let sent = 0;
  const deadAll = new Set();
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens
      .slice(i, i + CHUNK_SIZE)
      .map((to) => ({ to, sound: "default", title: cleanTitle, body: cleanBody, data: cleanData }));
    try {
      const dead = await sendChunk(chunk);
      dead.forEach((t) => deadAll.add(t));
      sent += chunk.length;
    } catch {
      // One bad chunk never kills the rest of the broadcast.
    }
  }
  for (const t of deadAll) {
    try {
      await env.PUSH_KV.delete(`token:${t}`);
    } catch {
      // ignore
    }
  }
  return { sent, devices: tokens.length, dropped: deadAll.size };
}

async function handleBroadcast(req, env) {
  if (
    !env.PUSH_BROADCAST_SECRET ||
    !safeEqual(req.headers.get("X-Broadcast-Secret"), env.PUSH_BROADCAST_SECRET)
  ) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }
  const ok = await checkRateLimit(env.PUSH_KV, "rl:broadcast", 20, 86400);
  if (!ok) {
    return json({ ok: false, error: "Daily broadcast limit reached." }, 429);
  }
  const { title, body, data } = await req.json().catch(() => ({}));
  if (!title || !body) {
    return json({ ok: false, error: "title and body are required." }, 400);
  }
  const result = await broadcast(env, title, body, data);
  return json({ ok: true, ...result });
}

/* ---------------------------- Shopify webhooks ---------------------------- */

async function verifyShopifyHmac(req, secret) {
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
  if (!hmacHeader || !secret) return null;
  const raw = await req.text();
  let sig;
  try {
    sig = Uint8Array.from(atob(hmacHeader), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sig,
    new TextEncoder().encode(raw)
  );
  return valid ? raw : null;
}

async function handleProductCreate(req, env) {
  const raw = await verifyShopifyHmac(req, env.SHOPIFY_WEBHOOK_SECRET);
  if (raw === null) return json({ ok: false, error: "Bad signature." }, 401);
  const product = JSON.parse(raw);
  // Draft/archived products shouldn't ping anyone.
  if (product.status && product.status !== "active") {
    return json({ ok: true, skipped: "not active" });
  }
  const result = await broadcast(env, "New drop 🔥", String(product.title ?? "New product"), {
    type: "product",
    id: String(product.id ?? ""),
  });
  return json({ ok: true, ...result });
}

async function handleCollectionCreate(req, env) {
  const raw = await verifyShopifyHmac(req, env.SHOPIFY_WEBHOOK_SECRET);
  if (raw === null) return json({ ok: false, error: "Bad signature." }, 401);
  const collection = JSON.parse(raw);
  const result = await broadcast(
    env,
    "New collection 💫",
    String(collection.title ?? "New collection"),
    { type: "collection", id: String(collection.handle ?? "") }
  );
  return json({ ok: true, ...result });
}

/* --------------------------------- router --------------------------------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (req.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "beatrackfam-push" });
    }
    if (req.method === "POST" && url.pathname === "/register") {
      return handleRegister(req, env);
    }
    if (req.method === "POST" && url.pathname === "/unregister") {
      return handleUnregister(req, env);
    }
    if (req.method === "POST" && url.pathname === "/broadcast") {
      return handleBroadcast(req, env);
    }
    if (req.method === "POST" && url.pathname === "/webhooks/products-create") {
      return handleProductCreate(req, env);
    }
    if (
      req.method === "POST" &&
      url.pathname === "/webhooks/collections-create"
    ) {
      return handleCollectionCreate(req, env);
    }
    return json({ ok: false, error: "Not found." }, 404);
  },
};
