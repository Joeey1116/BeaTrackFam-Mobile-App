/**
 * Client for the BeaTrackFam password-reset Cloudflare Worker.
 * The worker sends/validates 6-digit email codes via Resend; the actual
 * password hash always stays in the device's local account store.
 */
import {
  RESET_APP_SECRET,
  RESET_WORKER_URL,
  isPasswordResetConfigured,
} from "./resetConfig";
import { accountExists, setPasswordForEmail } from "./accounts";

export const isResetAvailable = isPasswordResetConfigured;

interface WorkerResult {
  ok: boolean;
  error?: string;
  resetToken?: string;
}

async function callWorker(
  path: "/request-code" | "/verify-code" | "/confirm-reset",
  body: Record<string, string>
): Promise<WorkerResult> {
  const res = await fetch(`${RESET_WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, appSecret: RESET_APP_SECRET }),
  });
  const data = (await res.json().catch(() => ({}))) as WorkerResult;
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? "Something went wrong." };
  }
  return data;
}

/** Sends a 6-digit reset code to the account's email. */
export async function requestResetCode(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const address = email.trim();
  if (!isPasswordResetConfigured()) {
    return { ok: false, error: "Password reset isn't set up yet." };
  }
  if (!(await accountExists(address))) {
    // Don't reveal whether the email has an account on this device.
    // Still return ok so nobody can probe for accounts.
    return { ok: true };
  }
  try {
    return await callWorker("/request-code", { email: address });
  } catch {
    return { ok: false, error: "Couldn't reach the reset service." };
  }
}

/** Verifies the 6-digit code; returns a single-use reset token. */
export async function verifyResetCode(
  email: string,
  code: string
): Promise<{ ok: boolean; resetToken?: string; error?: string }> {
  try {
    return await callWorker("/verify-code", { email: email.trim(), code });
  } catch {
    return { ok: false, error: "Couldn't reach the reset service." };
  }
}

/**
 * Confirms the reset token with the worker, then sets the new device-local
 * password. The token is single-use — the worker rejects replays.
 */
export async function resetPasswordWithToken(
  email: string,
  resetToken: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: "Choose a password with at least 6 characters." };
  }
  let confirmed: WorkerResult;
  try {
    confirmed = await callWorker("/confirm-reset", {
      email: email.trim(),
      resetToken,
    });
  } catch {
    return { ok: false, error: "Couldn't reach the reset service." };
  }
  if (!confirmed.ok) return { ok: false, error: confirmed.error };
  return setPasswordForEmail(email.trim(), newPassword);
}
