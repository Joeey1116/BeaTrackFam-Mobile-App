/**
 * BeaTrackFam app accounts — device-local accounts.
 *
 * Why this exists: the Shopify Customer Account API profile fetch kept
 * failing on real devices ("Couldn't load your profile from Shopify"),
 * which blocked sign-in entirely. App accounts don't depend on Shopify:
 * sign-up / sign-in / profile / addresses / order receipts all work
 * offline-first on the device.
 *
 * Honesty contract (do not weaken):
 * - Accounts are REGISTERED with the BeaTrackFam accounts worker
 *   (workers/accounts, lib/accountSync.ts) whenever the phone is
 *   online: delete the app, reinstall it, log in with the same email
 *   and you're back in. The phone keeps a local copy as its session
 *   store and offline fallback — profile extras (addresses,
 *   interests, receipts) live in that local copy and in Shopify, not
 *   in the registry; the registry holds name + email + password hash.
 * - If the worker is unreachable or not deployed yet, everything
 *   still works device-locally exactly as before, and pre-registry
 *   accounts register themselves on their owner's next login.
 * - Passwords are stored as salted SHA-256 hashes, never plaintext.
 * - Orders are linked to Shopify at CHECKOUT TIME: the buyer's name,
 *   email, phone and shipping address are attached to the Shopify
 *   Storefront cart as buyer identity (see lib/storefront.ts), so the
 *   Shopify order carries the customer's contact details and Shopify
 *   associates the order with that customer email. The app also keeps a
 *   local order receipt per account for order history.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { LocalProfile } from "./customer";
import { EMPTY_PROFILE } from "./customer";
import {
  changeRemotePassword,
  deleteRemoteAccount,
  isAccountSyncConfigured,
  loginRemoteAccount,
  registerRemoteAccount,
  remoteAccountExists,
  syncRemotePassword,
} from "./accountSync";

const ACCOUNTS_KEY = "beatrackfam-app-accounts-v1";
const SESSION_KEY = "beatrackfam-app-account-session-v1";

/* ---------------------------------- Types ---------------------------------- */

/** One line item snapshot stored on an order receipt. */
export interface ReceiptItem {
  productTitle: string;
  variantTitle: string;
  quantity: number;
  /** Decimal string unit price. */
  unitAmount: string;
  currencyCode: string;
  imageUrl: string | null;
}

export type OrderStatus = "completed" | "cancelled";

export interface OrderReceipt {
  /** Shopify order id (gid) when known, otherwise a local id. */
  id: string;
  /** ISO timestamp of when the app recorded the completed checkout. */
  placedAt: string;
  totalAmount: string;
  currencyCode: string;
  itemCount: number;
  /** Account email the order was placed under. */
  email: string;
  status: OrderStatus;
  items: ReceiptItem[];
}

export interface AppAccount {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  profile: LocalProfile;
  orders: OrderReceipt[];
}

export type AccountResult =
  | { ok: true; account: AppAccount }
  | { ok: false; reason: string };

/* --------------------------------- Hashing --------------------------------- */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}::${password}`
  );
}

/* --------------------------------- Storage --------------------------------- */

async function readAccounts(): Promise<Record<string, AppAccount>> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AppAccount>;
  } catch {
    return {};
  }
}

async function writeAccounts(
  accounts: Record<string, AppAccount>
): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)).catch(
    () => {}
  );
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeAccount(account: AppAccount): AppAccount {
  return {
    ...account,
    profile: { ...EMPTY_PROFILE, ...(account.profile ?? {}) },
    orders: Array.isArray(account.orders) ? account.orders : [],
  };
}

/* ------------------------------- Public API -------------------------------- */

/** True when an account already exists for this email (case-insensitive). */
export async function accountExists(email: string): Promise<boolean> {
  const accounts = await readAccounts();
  return Boolean(accounts[normalizeEmail(email)]);
}

/**
 * Creates a new device-local account. `seedProfile` (the guest's
 * device-local profile, if any) is copied in so nothing is lost.
 */
export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
  seedProfile?: LocalProfile;
}): Promise<AccountResult> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: "Enter a valid email address." };
  }
  if (name.length < 2) {
    return { ok: false, reason: "Enter your name." };
  }
  if (input.password.length < 6) {
    return {
      ok: false,
      reason: "Choose a password with at least 6 characters.",
    };
  }
  const accounts = await readAccounts();
  if (accounts[email]) {
    return {
      ok: false,
      reason: "An account with this email already exists on this device.",
    };
  }

  // Registered before (e.g. on a phone since wiped)? Don't duplicate —
  // logging in is the way back in.
  if (isAccountSyncConfigured()) {
    const existsRemotely = await remoteAccountExists(email);
    if (existsRemotely) {
      return {
        ok: false,
        reason:
          "This email is already registered — log in instead. Your account works on any phone.",
      };
    }
  }

  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(saltBytes);
  const passwordHash = await hashPassword(input.password, salt);

  const [firstName, ...rest] = name.split(/\s+/);
  const seed: LocalProfile = input.seedProfile
    ? { ...EMPTY_PROFILE, ...input.seedProfile }
    : { ...EMPTY_PROFILE };
  if (!seed.firstName) seed.firstName = firstName;
  if (!seed.lastName && rest.length) seed.lastName = rest.join(" ");

  const account: AppAccount = {
    id: `acct-${Date.now()}`,
    email,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    profile: seed,
    orders: [],
  };
  accounts[email] = account;
  await writeAccounts(accounts);
  await AsyncStorage.setItem(SESSION_KEY, account.id).catch(() => {});
  // Register with the accounts worker so this login survives an app
  // reinstall. Best-effort: offline sign-ups register on next login.
  void registerRemoteAccount({ name, email, password: input.password });
  return { ok: true, account: sanitizeAccount(account) };
}

/** Signs in — registry first (works on a fresh install), device-local fallback. */
export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AccountResult> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: "Enter a valid email address." };
  }
  const accounts = await readAccounts();

  // The registry is the source of truth when it's reachable — it's
  // what lets someone delete the app, reinstall, and just log in.
  if (isAccountSyncConfigured()) {
    const remote = await loginRemoteAccount({
      email,
      password: input.password,
    });
    if (remote.status === "ok") {
      const saltBytes = await Crypto.getRandomBytesAsync(16);
      const salt = bytesToHex(saltBytes);
      const passwordHash = await hashPassword(input.password, salt);
      let account = accounts[email];
      if (account) {
        // Keep the local copy in step with the verified password.
        account = { ...account, salt, passwordHash };
      } else {
        const [firstName, ...rest] = remote.name.trim().split(/\s+/);
        account = {
          id: `acct-${Date.now()}`,
          email,
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
          profile: {
            ...EMPTY_PROFILE,
            firstName: firstName ?? "",
            lastName: rest.join(" "),
          },
          orders: [],
        };
      }
      accounts[email] = account;
      await writeAccounts(accounts);
      await AsyncStorage.setItem(SESSION_KEY, account.id).catch(() => {});
      return { ok: true, account: sanitizeAccount(account) };
    }
    if (remote.status === "wrong-password") {
      return { ok: false, reason: "Incorrect password. Please try again." };
    }
    // "no-account" (pre-registry account) or registry unreachable:
    // fall through to the device-local account below.
  }

  const account = accounts[email];
  if (!account) {
    return {
      ok: false,
      reason: "No account found with this email on this device.",
    };
  }
  const attempt = await hashPassword(input.password, account.salt);
  if (attempt !== account.passwordHash) {
    return { ok: false, reason: "Incorrect password. Please try again." };
  }
  await AsyncStorage.setItem(SESSION_KEY, account.id).catch(() => {});
  // Accounts born before the registry register themselves here, so
  // their next reinstall is a plain log-in too.
  if (isAccountSyncConfigured()) {
    void (async () => {
      const exists = await remoteAccountExists(email);
      if (exists === false) {
        const name =
          [account.profile.firstName, account.profile.lastName]
            .filter(Boolean)
            .join(" ") || email.split("@")[0];
        await registerRemoteAccount({
          name,
          email,
          password: input.password,
        });
      }
    })();
  }
  return { ok: true, account: sanitizeAccount(account) };
}

/** The currently signed-in account, or null (guest). */
export async function getCurrentAccount(): Promise<AppAccount | null> {
  try {
    const [accounts, sessionId] = await Promise.all([
      readAccounts(),
      AsyncStorage.getItem(SESSION_KEY),
    ]);
    if (!sessionId) return null;
    const account = Object.values(accounts).find((a) => a.id === sessionId);
    return account ? sanitizeAccount(account) : null;
  } catch {
    return null;
  }
}

/** Persists a mutated copy of the current account. */
export async function saveAccount(account: AppAccount): Promise<void> {
  const accounts = await readAccounts();
  accounts[normalizeEmail(account.email)] = sanitizeAccount(account);
  await writeAccounts(accounts);
}

/** Signs out (keeps the account on the device). */
export async function signOutAccount(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
}

/** Records a completed-checkout receipt on the current account. */
export async function addOrderReceipt(
  receipt: Omit<OrderReceipt, "placedAt">
): Promise<AppAccount | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const next: AppAccount = {
    ...account,
    orders: [
      { ...receipt, placedAt: new Date().toISOString() },
      ...account.orders,
    ].slice(0, 100),
  };
  await saveAccount(next);
  return next;
}

/** Marks an order cancelled on the current account's history. */
export async function cancelOrderReceipt(
  orderId: string
): Promise<AppAccount | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const next: AppAccount = {
    ...account,
    orders: account.orders.map((o) =>
      o.id === orderId ? { ...o, status: "cancelled" as const } : o
    ),
  };
  await saveAccount(next);
  return next;
}

/** Changes the current account's password (verifies the old one). */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<AccountResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, reason: "You're not signed in." };
  if (newPassword.length < 6) {
    return {
      ok: false,
      reason: "Choose a password with at least 6 characters.",
    };
  }
  const attempt = await hashPassword(oldPassword, account.salt);
  if (attempt !== account.passwordHash) {
    return { ok: false, reason: "Your current password is incorrect." };
  }
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(saltBytes);
  const next: AppAccount = {
    ...account,
    salt,
    passwordHash: await hashPassword(newPassword, salt),
  };
  await saveAccount(next);
  void changeRemotePassword({
    email: account.email,
    oldPassword,
    newPassword,
  });
  return { ok: true, account: next };
}

/**
 * Sets a new password for the account with this email (no old password
 * required). Only call after the reset code was verified with the
 * password-reset worker — the worker's single-use token is the proof.
 */
export async function setPasswordForEmail(
  email: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: "Choose a password with at least 6 characters." };
  }
  const accounts = await readAccounts();
  const key = normalizeEmail(email);
  const account = accounts[key];
  if (!account) return { ok: false, error: "No account found for that email." };
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(saltBytes);
  accounts[key] = {
    ...account,
    salt,
    passwordHash: await hashPassword(newPassword, salt),
  };
  await writeAccounts(accounts);
  // Keep the registry in step so the new password logs in anywhere.
  void syncRemotePassword({ email: key, password: newPassword });
  return { ok: true };
}

/** True when `password` matches the signed-in account's local copy. */
export async function verifyCurrentPassword(
  password: string
): Promise<boolean> {
  const account = await getCurrentAccount();
  if (!account) return false;
  const attempt = await hashPassword(password, account.salt);
  return attempt === account.passwordHash;
}

/**
 * Permanently deletes the current account: the registry record goes
 * too (freeing the email — coming back means signing up again), then
 * all device data. Password is verified first so a borrowed phone
 * can't nuke the account from the Settings screen.
 */
export async function deleteCurrentAccount(
  password: string
): Promise<{ ok: boolean; reason?: string }> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, reason: "You're not signed in." };
  const attempt = await hashPassword(password, account.salt);
  if (attempt !== account.passwordHash) {
    return {
      ok: false,
      reason: "That password doesn't match — account not deleted.",
    };
  }
  await deleteRemoteAccount({ email: account.email, password }).catch(
    () => false
  );
  const accounts = await readAccounts();
  delete accounts[normalizeEmail(account.email)];
  await writeAccounts(accounts);
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  return { ok: true };
}
