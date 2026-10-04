/**
 * Client for the BeaTrackFam accounts worker (lib/accountsConfig.ts).
 *
 * The worker is the account registry: it lets a customer delete the
 * app, reinstall it, and log in again with the same email. The device
 * keeps its own local copy (lib/accounts.ts) for offline use and as
 * the session store; this module is only ever called best-effort and
 * every failure mode maps to "unavailable" so callers can fall back
 * to the device-local flow. Nothing here blocks sign-in on its own.
 */
import {
  ACCOUNTS_APP_SECRET,
  ACCOUNTS_WORKER_URL,
  isAccountSyncConfigured,
} from "./accountsConfig";

export { isAccountSyncConfigured };

export type RemoteRegisterResult = "ok" | "exists" | "unavailable";
export type RemoteLoginResult =
  | { status: "ok"; name: string }
  | { status: "wrong-password" }
  | { status: "no-account" }
  | { status: "unavailable" };

const TIMEOUT_MS = 6000;

async function callWorker(
  path:
    | "/register"
    | "/exists"
    | "/login"
    | "/delete"
    | "/change-password"
    | "/sync-password",
  body: Record<string, string>
): Promise<{ status: number; data: Record<string, unknown> } | null> {
  if (!isAccountSyncConfigured()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ACCOUNTS_WORKER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, appSecret: ACCOUNTS_APP_SECRET }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return { status: res.status, data };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True/false when the registry answered, null when unreachable. */
export async function remoteAccountExists(
  email: string
): Promise<boolean | null> {
  const res = await callWorker("/exists", { email });
  if (!res || res.status !== 200) return null;
  return res.data.exists === true;
}

export async function registerRemoteAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RemoteRegisterResult> {
  const res = await callWorker("/register", input);
  if (!res) return "unavailable";
  if (res.status === 200) return "ok";
  if (res.status === 409) return "exists";
  return "unavailable";
}

export async function loginRemoteAccount(input: {
  email: string;
  password: string;
}): Promise<RemoteLoginResult> {
  const res = await callWorker("/login", input);
  if (!res) return { status: "unavailable" };
  if (res.status === 200 && typeof res.data.name === "string") {
    return { status: "ok", name: res.data.name };
  }
  if (res.status === 401) return { status: "wrong-password" };
  if (res.status === 404) return { status: "no-account" };
  return { status: "unavailable" };
}

/** Removes the registry record (frees the email). Best-effort. */
export async function deleteRemoteAccount(input: {
  email: string;
  password: string;
}): Promise<boolean> {
  const res = await callWorker("/delete", input);
  return Boolean(res && res.status === 200);
}

/** Re-keys the registry after an in-app password change. Best-effort. */
export async function changeRemotePassword(input: {
  email: string;
  oldPassword: string;
  newPassword: string;
}): Promise<boolean> {
  const res = await callWorker("/change-password", input);
  return Boolean(res && res.status === 200);
}

/** Re-keys the registry after an email-code password reset. Best-effort. */
export async function syncRemotePassword(input: {
  email: string;
  password: string;
}): Promise<boolean> {
  const res = await callWorker("/sync-password", input);
  return Boolean(res && res.status === 200);
}
