/**
 * Judge.me reviews — app-side client.
 *
 * The app NEVER talks to Judge.me directly and ships NO Judge.me token of
 * any kind (the /reviews endpoint rejects the public token). ALL review
 * traffic — reads and writes — goes through the Cloudflare worker in
 * workers/reviews/, which holds the private API token as a secret.
 * See workers/reviews/README.md for setup.
 *
 * Until REVIEWS_WORKER_URL below is filled in, isReviewsConfigured()
 * returns false and the product screen hides the reviews section entirely.
 */

/** Public URL of the deployed beatrackfam-reviews worker. */
export const REVIEWS_WORKER_URL = "https://beatrackfam-reviews.contact-beatrackfam.workers.dev";

/** True only when reviews are fully configured — otherwise hide the UI. */
export function isReviewsConfigured(): boolean {
  return REVIEWS_WORKER_URL.trim().length > 0;
}

export interface ReviewSummary {
  average: number;
  count: number;
  /** Star -> review count, keys "5".."1". */
  distribution: Record<string, number>;
}

export interface ProductReview {
  id: number;
  title: string;
  body: string;
  rating: number;
  reviewerName: string;
  verified: boolean;
  createdAt: string;
}

export interface ReviewsPage {
  summary: ReviewSummary;
  reviews: ProductReview[];
  page: number;
  perPage: number;
  hasMore: boolean;
}

export interface ReviewSubmission {
  productId: string;
  name: string;
  email: string;
  rating: number;
  title: string;
  body: string;
}

function workerBase(): string {
  return REVIEWS_WORKER_URL.trim().replace(/\/+$/, "");
}

/**
 * Loads one page of published reviews + the rating summary for a product.
 * Throws with a human-readable message on failure.
 */
export async function fetchReviews(
  productNumericId: string,
  page = 1,
  perPage = 5
): Promise<ReviewsPage> {
  const url =
    `${workerBase()}/reviews?productId=${encodeURIComponent(productNumericId)}` +
    `&page=${page}&perPage=${perPage}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Couldn't reach the reviews service. Check your connection.");
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  } & Partial<ReviewsPage>;
  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? "Couldn't load reviews.");
  }
  return {
    summary: data.summary ?? { average: 0, count: 0, distribution: {} },
    reviews: data.reviews ?? [],
    page: data.page ?? 1,
    perPage: data.perPage ?? perPage,
    hasMore: data.hasMore ?? false,
  };
}

/**
 * Submits a review through the worker (validated + rate-limited server-side,
 * then forwarded to Judge.me). Throws with a human-readable message.
 */
export async function submitReview(input: ReviewSubmission): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${workerBase()}/submit-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Couldn't submit the review. Check your connection.");
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? "Couldn't submit the review.");
  }
}
