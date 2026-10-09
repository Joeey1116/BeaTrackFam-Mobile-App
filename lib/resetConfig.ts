/**
 * Password-reset service configuration.
 *
 * RESET_WORKER_URL: your deployed Cloudflare Worker's public URL, e.g.
 *   "https://beatrackfam-password-reset.joey.workers.dev"
 * Paste it here after deploying (see workers/password-reset/README.md).
 * Leave the placeholder to keep "Forgot password?" hidden until the
 * service is live.
 *
 * RESET_APP_SECRET: abuse/quota guard shared with the worker (stored as an
 * encrypted worker secret on the Cloudflare side). It ships inside the app
 * bundle, so treat it as a speed bump against endpoint abuse — the real
 * security is the 6-digit code delivered to the user's email inbox.
 */
export const RESET_WORKER_URL = "https://beatrackfam-password-reset.contact-beatrackfam.workers.dev";

export const RESET_APP_SECRET =
  "e8bd0656fafe2bd04ebf7eddc9992259989f32418f86bd48";

/** True once Joey has deployed the worker and pasted its URL above. */
export const isPasswordResetConfigured = () =>
  RESET_WORKER_URL.startsWith("https://");
