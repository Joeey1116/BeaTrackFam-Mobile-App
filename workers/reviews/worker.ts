/**
 * BeaTrackFam reviews worker (Cloudflare Workers, free tier).
 *
 * Proxies the store's Judge.me reviews so the app never ships API tokens.
 *
 * Endpoints (JSON):
 *   GET  /reviews?productId=<numeric>&page=<n>&perPage=<m>
 *        -> { ok, summary: { average, count, distribution: {5,4,3,2,1} },
 *             reviews: [{ id, title, body, rating, reviewerName, verified,
 *                         createdAt }], page, perPage, hasMore }
 *   POST /submit-review  { productId, name, email, rating, title, body }
 *        -> { ok: true }
 *
 * Secrets (wrangler secret put): JUDGEME_PRIVATE_TOKEN
 * KV binding: REVIEWS_KV (rate limiting)
 *
 * Judge.me API notes (verified against https://judge.me/api/docs):
 * - Raw review reads (GET /api/v1/reviews "Index") require the PRIVATE API
 *   key (sent in the X-Api-Token header) + shop_domain, so they must go
 *   through this worker. The public key is rejected by this endpoint
 *   ("public token which does not have enough permissions"), so NO token of
 *   any kind ships in the app — all review traffic goes through this worker.
 * - shop_domain MUST be the myshopify domain (rp4j61-zf.myshopify.com);
 *   the custom domain is rejected with "Failed to authenticate".
 * - Creating a review (POST /api/v1/reviews "Create") needs NO
 *   authorization — it behaves like the public web form. This worker still
 *   fronts it for input validation + rate limiting (spam guard), and so a
 *   private token is never required for writes.
 * - Index responses are RAW (unsanitized, may include unpublished reviews):
 *   this worker filters to published (hidden === false) and strips HTML.
 * - Reviews only land if the store has web reviews enabled in Judge.me.
 */

interface Env {
  REVIEWS_KV: KVNamespace;
  JUDGEME_PRIVATE_TOKEN: string;
}

const SHOP_DOMAIN = "rp4j61-zf.myshopify.com";
const JUDGEME_API = "https://api.judge.me/api/v1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Reviews pulled from Judge.me per read (summary computed over all of them). */
const MAX_FETCH = 100;

interface JudgeMeReviewer {
  name?: string | null;
}
interface JudgeMeRawReview {
  id: number;
  title?: string | null;
  body?: string | null;
  rating?: number | null;
  product_external_id?: number | null;
  hidden?: boolean | null;
  verified?: string | null;
  created_at?: string | null;
  reviewer?: JudgeMeReviewer | null;
}
interface JudgeMeIndexResponse {
  reviews?: JudgeMeRawReview[];
}

/** Strip HTML tags + decode common entities from raw Judge.me content. */
function sanitize(text: string | null | undefined): string {
  const s = (text ?? "").replace(/<[^>]*>/g, "");
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
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

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for") ??
    "unknown"
  );
}

interface CleanReview {
  id: number;
  title: string;
  body: string;
  rating: number;
  reviewerName: string;
  verified: boolean;
  createdAt: string;
}

async function handleGetReviews(
  req: Request,
  env: Env
): Promise<Response> {
  const url = new URL(req.url);
  const productId = (url.searchParams.get("productId") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const perPage = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("perPage") ?? 5) || 5)
  );

  if (!/^\d+$/.test(productId)) {
    return json({ ok: false, error: "Invalid product id." }, 400);
  }
  if (!env.JUDGEME_PRIVATE_TOKEN) {
    return json({ ok: false, error: "Reviews are not configured." }, 503);
  }
  const ipOk = await checkRateLimit(env.REVIEWS_KV, `rl:read:${clientIp(req)}`, 60, 3600);
  if (!ipOk) {
    return json({ ok: false, error: "Too many requests. Try again later." }, 429);
  }

  let jmRes: Response;
  try {
    const params = new URLSearchParams({
      shop_domain: SHOP_DOMAIN,
      product_external_id: productId,
      per_page: String(MAX_FETCH),
      page: "1",
    });
    jmRes = await fetch(`${JUDGEME_API}/reviews?${params.toString()}`, {
      headers: { "X-Api-Token": env.JUDGEME_PRIVATE_TOKEN },
    });
  } catch {
    return json({ ok: false, error: "Couldn't reach the reviews service." }, 502);
  }
  if (!jmRes.ok) {
    return json({ ok: false, error: "Couldn't load reviews." }, 502);
  }
  const data = (await jmRes.json().catch(() => ({}))) as JudgeMeIndexResponse;
  // Belt-and-braces: the endpoint already filters by product_external_id.
  const published = (data.reviews ?? []).filter((r) => r.hidden !== true);

  const clean: CleanReview[] = published.map((r) => ({
    id: r.id,
    title: sanitize(r.title),
    body: sanitize(r.body),
    rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
    reviewerName: sanitize(r.reviewer?.name) || "Verified shopper",
    verified: r.verified === "buyer",
    createdAt: r.created_at ?? "",
  }));

  const count = clean.length;
  const distribution: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  let sum = 0;
  for (const r of clean) {
    sum += r.rating;
    distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1;
  }
  const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

  const totalPages = Math.max(1, Math.ceil(count / perPage));
  const safePage = Math.min(page, totalPages);
  const pageReviews = clean.slice((safePage - 1) * perPage, safePage * perPage);

  return json({
    ok: true,
    summary: { average, count, distribution },
    reviews: pageReviews,
    page: safePage,
    perPage,
    hasMore: count > safePage * perPage,
  });
}

async function handleSubmitReview(
  req: Request,
  env: Env
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    productId?: string;
    name?: string;
    email?: string;
    rating?: number;
    title?: string;
    body?: string;
  };
  const productId = (body.productId ?? "").trim();
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const rating = Number(body.rating);
  const title = (body.title ?? "").trim();
  const reviewBody = (body.body ?? "").trim();

  if (!/^\d+$/.test(productId)) {
    return json({ ok: false, error: "Invalid product." }, 400);
  }
  if (name.length < 1 || name.length > 60) {
    return json({ ok: false, error: "Enter your name." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ ok: false, error: "Pick a star rating." }, 400);
  }
  if (title.length > 120) {
    return json({ ok: false, error: "Keep the headline under 120 characters." }, 400);
  }
  if (reviewBody.length < 1 || reviewBody.length > 2000) {
    return json({ ok: false, error: "Write your review (up to 2000 characters)." }, 400);
  }

  const ip = clientIp(req);
  const ipOk = await checkRateLimit(env.REVIEWS_KV, `rl:write:ip:${ip}`, 5, 3600);
  const emailOk = await checkRateLimit(env.REVIEWS_KV, `rl:write:email:${email}`, 3, 3600);
  if (!ipOk || !emailOk) {
    return json({ ok: false, error: "Too many reviews submitted. Try again later." }, 429);
  }

  // Judge.me "Create" needs no auth — it mirrors the public web review form.
  let jmRes: Response;
  try {
    jmRes = await fetch(`${JUDGEME_API}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_domain: SHOP_DOMAIN,
        platform: "shopify",
        id: Number(productId),
        name,
        email,
        rating,
        title,
        body: reviewBody,
      }),
    });
  } catch {
    return json({ ok: false, error: "Couldn't submit the review. Try again." }, 502);
  }
  if (!jmRes.ok) {
    return json({ ok: false, error: "Judge.me didn't accept the review." }, 502);
  }
  return json({ ok: true });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/reviews") {
      return handleGetReviews(req, env);
    }
    if (req.method === "POST" && url.pathname === "/submit-review") {
      return handleSubmitReview(req, env);
    }
    return json({ ok: false, error: "Not found." }, 404);
  },
};
