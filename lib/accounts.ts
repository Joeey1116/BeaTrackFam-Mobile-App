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
 * - These accounts live ON THIS DEVICE ONLY (AsyncStorage). They are not
 *   cloud accounts — signing in on another phone won't carry them over.
 *   The UI must say so wherever accounts are created.
 * - Passwords are stored as salted SHA-256 hashes, never plaintext. This
 *   is appropriate for device-local data (sandboxed storage + device
 *   encryption), NOT server-grade password storage — and we never claim
 *   otherwise.
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
  return { ok: true, account: sanitizeAccount(account) };
}

/** Signs in to a device-local account. */
export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AccountResult> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: "Enter a valid email address." };
  }
  const accounts = await readAccounts();
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
  return { ok: true };
}

/** Permanently deletes the current account and all its device data. */
export async function deleteCurrentAccount(): Promise<void> {
  const account = await getCurrentAccount();
  if (account) {
    const accounts = await readAccounts();
    delete accounts[normalizeEmail(account.email)];
    await writeAccounts(accounts);
  }
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
}
