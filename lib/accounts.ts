/**
 * BeaTrackFam app accounts — the site's D1 customer_accounts is the
 * single source of truth; this module is the app's client for it plus
 * the device-local session/profile/receipt cache.
 *
 * AUTH (contract with the backend agent — read before touching):
 * - POST /api/account/login and /api/account/signup return
 *   { ok, account: { email, name }, session_token } and every
 *   /api/account/* call additionally accepts
 *   `Authorization: Bearer <session_token>`.
 * - The token is stored in AsyncStorage and sent on every account
 *   call. React Native fetch does not persist the site's
 *   HttpOnly session cookie, so cookie-only auth is NOT sufficient
 *   for the app — if the token is missing, authed calls 401 and the
 *   screens fall back to local receipts + guest lookup.
 * - Live status (Nov 4, 2026): the token field IS live — login/signup
 *   JSON returns session_token and /api/account/* accepts the Bearer
 *   header (negative paths curl-verified: bad password -> 401,
 *   garbage Bearer -> 401 on /me and /orders). The positive
 *   round-trip (real sign-in returning a token) is NOT yet verified
 *   because creating a real prod customer account for the test needs
 *   parent approval — see the rebuild report.
 *
 * What lives where:
 * - Site: email + name + password hash (PBKDF2, server-side) +
 *   addresses + orders. The app never sees or stores a password hash.
 * - Device: the session (which account is signed in), the editable
 *   profile copy (addresses, interests, socials, avatar), local
 *   checkout receipts, and guest/site orders linked to the account.
 *   Profile edits save locally immediately and push the name to the
 *   site best-effort; new addresses are posted to the site
 *   best-effort at add time (edits/deletes of site addresses are not
 *   tracked — site address ids are not stored locally — so an edited
 *   or deleted local address does not propagate; that is a known gap,
 *   not silent sync).
 *
 * Passwords: the site requires at least 8 characters. Old device-local
 * accounts (salted SHA-256 hashes from the retired KV registry era)
 * are NOT migrated by copying hashes — the site hashes with PBKDF2
 * and the two schemes are incompatible (see
 * docs/accounts-pbkdf2-finding.md). On upgrade, any stored local
 * password hash/salt is stripped from the device the first time the
 * store is read; affected users sign in with their site password or
 * use the site's email-link reset.
 *
 * Guest checkout stays: guests never need an account, and any order
 * (guest or signed-in) can be looked up by order number + checkout
 * email via POST /api/guest-order-lookup.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SITE_BACKEND_URL } from "./checkoutConfig";

const ACCOUNTS_KEY = "beatrackfam-app-accounts-v1";
const SESSION_KEY = "beatrackfam-app-account-session-v1";
const TOKEN_KEY = "beatrackfam-site-session-token-v1";

/* --------------------------- Local profile types --------------------------- */
/* Moved here from the deleted lib/customer.ts — same shapes, same key. */

export interface SocialHandles {
  instagram: string;
  tiktok: string;
  facebook: string;
  x: string;
}

export interface LocalAddress {
  id: string;
  label: string;
  name: string;
  street: string;
  street2: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export interface LocalProfile {
  addresses: LocalAddress[];
  interests: string[];
  socials: SocialHandles;
  avatarUri: string | null;
  firstName: string;
  lastName: string;
  phone: string;
}

const PROFILE_KEY = "beatrackfam-profile-local";

export const EMPTY_PROFILE: LocalProfile = {
  addresses: [],
  interests: [],
  socials: { instagram: "", tiktok: "", facebook: "", x: "" },
  avatarUri: null,
  firstName: "",
  lastName: "",
  phone: "",
};

export async function getLocalProfile(): Promise<LocalProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<LocalProfile>) };
  } catch {
    return EMPTY_PROFILE;
  }
}

export async function saveLocalProfile(profile: LocalProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(
    () => {}
  );
}

export async function clearLocalProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY).catch(() => {});
}

/* ------------------------------ Receipt types ------------------------------ */

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

export type OrderStatus = "completed" | "cancelled" | "cancellation-requested";

export interface OrderReceipt {
  /** Site order number (BTF-YYYYMMDD-XXXX) when known, else a local id. */
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

/** A site order snapshot linked to this app account from Order History. */
export interface LinkedSiteOrder {
  number: string;
  status: string;
  totalAmount: string;
  currencyCode: string;
  placedAt: string;
  email: string;
}

export interface AppAccount {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  profile: LocalProfile;
  orders: OrderReceipt[];
  /** Site orders bookmarked onto this account from Order History. */
  linkedSiteOrders?: LinkedSiteOrder[];
}

export type AccountResult =
  | { ok: true; account: AppAccount }
  | { ok: false; reason: string };

/* ------------------------------- Site types -------------------------------- */

export interface SiteOrderItem {
  handle: string;
  title: string;
  variantLabel: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

/** One order row from GET /api/account/me. */
export interface SiteOrder {
  number: string;
  status: string;
  totalCents: number;
  /** Server-formatted total, e.g. "$19.99". */
  total: string;
  createdAt: string;
  items: SiteOrderItem[];
}

/**
 * One order row from GET /api/account/orders (the order-LIST endpoint,
 * newest first, max 50). NOTE: item_count is order_items ROWS (lines),
 * not summed quantities — history screens must show it as a line
 * count, never as an item quantity.
 */
export interface SiteOrderSummary {
  number: string;
  createdAt: string;
  totalCents: number;
  status: string;
  /** Line count (order_items rows), NOT summed quantities. */
  itemCount: number;
}

export interface SiteOrderDetail {
  number: string;
  status: string;
  printifyStatus: string | null;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number | null;
  taxCents: number;
  discountCents: number;
  discountCode: string | null;
  createdAt: string;
  customerName: string | null;
  shippingAddress: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
  };
  orderNotes: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: SiteOrderItem[];
}

export interface SiteAccountView {
  account: { email: string; name: string };
  orders: SiteOrder[];
  addresses: Array<Record<string, unknown>>;
  newsletterSubscribed: boolean;
}

export interface SiteAffiliate {
  code: string;
  link: string;
  rate: string;
  rateBasisPoints: number;
  totalEarningsCents: number;
  totalEarnings: string;
  orders: Array<{
    order_number: string;
    date: string;
    commission_cents: number;
    commission: string;
    status: string;
  }>;
  payouts: Array<{
    amount_cents: number;
    amount: string;
    status: string;
    created_at: string;
    note: string;
  }>;
  name: string | null;
  paymentMethod: string | null;
  paymentHandle: string | null;
}

/** "$19.99" from integer cents — the site API speaks cents only. */
export function formatCents(cents: number | null | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

/** Human label for a site order status. */
export function siteOrderStatusLabel(status: string): string {
  switch ((status ?? "").toLowerCase()) {
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    case "delivered":
      return "Delivered";
    case "shipped":
      return "Shipped";
    case "paid":
    case "printify_pending":
    case "printify_held_awaiting_merchant_payment":
    case "in_production":
      return "Processing";
    case "pending_payment":
      return "Payment pending";
    default:
      return "Processing";
  }
}

/* ------------------------------ Site API client ---------------------------- */

async function getSessionToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function hasSessionToken(): Promise<boolean> {
  return (await getSessionToken()) !== null;
}

async function setSessionToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Session still works locally; authed calls will 401 until set.
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

type SiteCallResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number };

async function siteCall<T>(
  path: string,
  opts?: { method?: string; body?: Record<string, unknown>; authed?: boolean }
): Promise<SiteCallResult<T>> {
  const method = opts?.method ?? (opts?.body ? "POST" : "GET");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts?.authed !== false) {
    Object.assign(headers, await authHeaders());
  }
  let res: Response;
  try {
    res = await fetch(`${SITE_BACKEND_URL}${path}`, {
      method,
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the store. Check your connection and try again.",
      status: 0,
    };
  }
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    session_token?: string;
  };
  if (!res.ok || (data as { error?: string }).error) {
    return {
      ok: false,
      error:
        (data as { error?: string }).error ||
        "Something went wrong. Please try again.",
      status: res.status,
    };
  }
  return { ok: true, data, status: res.status };
}

/** Stores the session token when the backend returns one (contract). */
async function captureToken(data: { session_token?: string }): Promise<void> {
  if (typeof data.session_token === "string" && data.session_token) {
    await setSessionToken(data.session_token);
  }
}

/* --------------------------- Local account storage -------------------------- */

type StoredAccount = AppAccount & Record<string, unknown>;

let credentialStripWritten = false;

async function readAccounts(): Promise<Record<string, AppAccount>> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredAccount>;
    const out: Record<string, AppAccount> = {};
    let hadCredentials = false;
    for (const [key, value] of Object.entries(parsed)) {
      const {
        passwordHash: _ph,
        salt: _salt,
        authProvider: _ap,
        shopifyCustomerId: _sc,
        linkedShopifyOrders: _ls,
        ...rest
      } = value;
      if (_ph !== undefined || _salt !== undefined) hadCredentials = true;
      out[key] = sanitizeAccount(rest as AppAccount);
    }
    // One-time upgrade hygiene: old local password hashes must not
    // linger on the device once the site is the credential authority.
    if (hadCredentials && !credentialStripWritten) {
      credentialStripWritten = true;
      void writeAccounts(out);
    }
    return out;
  } catch {
    return {};
  }
}

async function writeAccounts(
  accounts: Record<string, AppAccount>
): Promise<void> {
  const stripped: Record<string, AppAccount> = {};
  for (const [key, value] of Object.entries(accounts)) {
    stripped[key] = sanitizeAccount(value);
  }
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stripped)).catch(
    () => {}
  );
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeAccount(account: AppAccount): AppAccount {
  return {
    id: account.id,
    email: account.email,
    name: account.name ?? "",
    createdAt: account.createdAt,
    profile: { ...EMPTY_PROFILE, ...(account.profile ?? {}) },
    orders: Array.isArray(account.orders) ? account.orders : [],
    linkedSiteOrders: Array.isArray(account.linkedSiteOrders)
      ? account.linkedSiteOrders
      : [],
  };
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") };
}

/* ------------------------------- Public API -------------------------------- */

/**
 * Creates a site account, then the local session for it. `seedProfile`
 * (the guest's device-local profile, if any) is copied in so nothing
 * is lost. The site requires passwords of at least 8 characters.
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
  if (input.password.length < 8) {
    return {
      ok: false,
      reason: "Choose a password with at least 8 characters.",
    };
  }
  const res = await siteCall<{
    account?: { email?: string; name?: string };
    session_token?: string;
  }>("/api/account/signup", {
    body: { name, email, password: input.password },
    authed: false,
  });
  if (!res.ok) {
    if (res.status === 409) {
      return {
        ok: false,
        reason:
          "This email is already registered — log in instead. Your account works on any phone.",
      };
    }
    return { ok: false, reason: res.error };
  }
  await captureToken(res.data);
  const accounts = await readAccounts();
  const seed: LocalProfile = input.seedProfile
    ? { ...EMPTY_PROFILE, ...input.seedProfile }
    : { ...EMPTY_PROFILE };
  const { firstName, lastName } = splitName(name);
  if (!seed.firstName) seed.firstName = firstName;
  if (!seed.lastName) seed.lastName = lastName;
  const account: AppAccount = {
    id: `acct-${Date.now()}`,
    email,
    name,
    createdAt: new Date().toISOString(),
    profile: seed,
    orders: accounts[email]?.orders ?? [],
    linkedSiteOrders: accounts[email]?.linkedSiteOrders ?? [],
  };
  accounts[email] = account;
  await writeAccounts(accounts);
  await AsyncStorage.setItem(SESSION_KEY, account.id).catch(() => {});
  return { ok: true, account: sanitizeAccount(account) };
}

/** Signs in against the site. Works on a fresh install by design. */
export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AccountResult> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: "Enter a valid email address." };
  }
  const res = await siteCall<{
    account?: { email?: string; name?: string };
    session_token?: string;
  }>("/api/account/login", {
    body: { email, password: input.password },
    authed: false,
  });
  if (!res.ok) {
    if (res.status === 401) {
      return { ok: false, reason: "Incorrect email or password." };
    }
    if (res.status === 429) {
      return {
        ok: false,
        reason: "Too many sign-in attempts — please wait a few minutes.",
      };
    }
    return { ok: false, reason: res.error };
  }
  await captureToken(res.data);
  const accounts = await readAccounts();
  const name = res.data.account?.name ?? "";
  const existing = accounts[email];
  const { firstName, lastName } = splitName(name);
  const account: AppAccount = existing
    ? { ...existing, name: name || existing.name }
    : {
        id: `acct-${Date.now()}`,
        email,
        name,
        createdAt: new Date().toISOString(),
        profile: {
          ...EMPTY_PROFILE,
          firstName,
          lastName,
        },
        orders: [],
        linkedSiteOrders: [],
      };
  accounts[email] = account;
  await writeAccounts(accounts);
  await AsyncStorage.setItem(SESSION_KEY, account.id).catch(() => {});
  return { ok: true, account: sanitizeAccount(account) };
}

/**
 * Saves a site order snapshot onto the currently signed-in app
 * account ("Link to my account" in Order History). Dedupes by order
 * number; re-linking refreshes the snapshot. Returns the updated
 * account, or null when nobody is signed into the app.
 */
export async function linkSiteOrderToCurrentAccount(
  order: LinkedSiteOrder
): Promise<AppAccount | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const rest = (account.linkedSiteOrders ?? []).filter(
    (o) => o.number !== order.number
  );
  const next: AppAccount = {
    ...account,
    linkedSiteOrders: [order, ...rest].slice(0, 100),
  };
  await saveAccount(next);
  return next;
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

/**
 * Persists a mutated copy of the current account. When the account
 * name changed, it is pushed to the site best-effort (PUT
 * /api/account/profile) — a failed push never blocks the local save.
 */
export async function saveAccount(account: AppAccount): Promise<void> {
  const accounts = await readAccounts();
  const previous = accounts[normalizeEmail(account.email)];
  const next = sanitizeAccount(account);
  accounts[normalizeEmail(account.email)] = next;
  await writeAccounts(accounts);
  if (previous && previous.name !== next.name && next.name) {
    void siteCall("/api/account/profile", {
      method: "PUT",
      body: { name: next.name },
    }).catch(() => {});
  }
}

/** Signs out: ends the site session best-effort, clears token + session. */
export async function signOutAccount(): Promise<void> {
  void siteCall("/api/account/logout", { body: {} }).catch(() => {});
  await setSessionToken(null);
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
export async function requestCancelOrderReceipt(
  orderId: string
): Promise<AppAccount | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const next: AppAccount = {
    ...account,
    orders: account.orders.map((o) =>
      o.id === orderId ? { ...o, status: "cancellation-requested" as const } : o
    ),
  };
  await saveAccount(next);
  return next;
}

/** Changes the signed-in account's password on the site. */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<AccountResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, reason: "You're not signed in." };
  if (newPassword.length < 8) {
    return {
      ok: false,
      reason: "Choose a password with at least 8 characters.",
    };
  }
  const res = await siteCall("/api/account/change-password", {
    body: { current_password: oldPassword, new_password: newPassword },
  });
  if (!res.ok) {
    if (res.status === 401) {
      return { ok: false, reason: "Your current password is incorrect." };
    }
    return { ok: false, reason: res.error };
  }
  return { ok: true, account };
}

/**
 * Deletes the device-side account after verifying the password with a
 * site login. The site has NO account-delete endpoint, so this does
 * NOT delete the server-side registration or free the email — the
 * Delete Account screen says exactly that and points at the email
 * request for server-side removal. Deleting locally then re-signing
 * in with the same email still works.
 */
export async function deleteCurrentAccount(
  password: string
): Promise<{ ok: boolean; reason?: string }> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, reason: "You're not signed in." };
  const verify = await siteCall<{
    account?: { email?: string; name?: string };
    session_token?: string;
  }>("/api/account/login", {
    body: { email: account.email, password },
    authed: false,
  });
  if (!verify.ok) {
    if (verify.status === 401) {
      return {
        ok: false,
        reason: "That password doesn't match — account not deleted.",
      };
    }
    return { ok: false, reason: verify.error };
  }
  await captureToken(verify.data);
  await signOutAccount();
  const accounts = await readAccounts();
  delete accounts[normalizeEmail(account.email)];
  await writeAccounts(accounts);
  return { ok: true };
}

/* ------------------------- Site account reads ------------------------------ */

/**
 * The signed-in site account: profile, live orders, addresses.
 * Returns null when the server says "not signed in" (no token yet, or
 * expired) — callers fall back to local receipts + guest lookup.
 * Throws on network failure.
 */
export async function fetchSiteAccount(): Promise<SiteAccountView | null> {
  const res = await siteCall<{
    account?: { email: string; name: string };
    orders?: SiteOrder[];
    addresses?: Array<Record<string, unknown>>;
    newsletter_subscribed?: boolean;
  }>("/api/account/me", { method: "GET" });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error(res.error);
  }
  return {
    account: res.data.account ?? { email: "", name: "" },
    orders: res.data.orders ?? [],
    addresses: res.data.addresses ?? [],
    newsletterSubscribed: res.data.newsletter_subscribed ?? false,
  };
}

/**
 * The signed-in account's order list (GET /api/account/orders).
 * Returns null when the server says "not signed in" (no token yet, or
 * expired) — callers fall back to local receipts + guest lookup.
 * Throws on network failure.
 */
export async function fetchSiteOrderList(): Promise<SiteOrderSummary[] | null> {
  const res = await siteCall<{
    orders?: Array<Record<string, unknown>>;
  }>("/api/account/orders", { method: "GET" });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error(res.error);
  }
  return (res.data.orders ?? []).map((o) => ({
    number: String(o.order_number ?? ""),
    createdAt: String(o.created_at ?? ""),
    totalCents: Number(o.total_cents ?? 0),
    status: String(o.status ?? ""),
    itemCount: Number(o.item_count ?? 0),
  }));
}

/** Live detail for one signed-in order, by site order number. */
export async function fetchSiteOrderDetail(
  orderNumber: string
): Promise<SiteOrderDetail> {
  const res = await siteCall<{ order?: Record<string, unknown> }>(
    `/api/account/orders/${encodeURIComponent(orderNumber.trim().toUpperCase())}`,
    { method: "GET" }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("Order not found.");
    if (res.status === 401) {
      throw new Error("You're not signed in on the store — sign in and try again.");
    }
    throw new Error(res.error);
  }
  const o = (res.data.order ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(o.items) ? o.items : []) as Array<
    Record<string, unknown>
  >;
  const addr = (o.shipping_address ?? {}) as Record<string, unknown>;
  return {
    number: String(o.number ?? orderNumber),
    status: String(o.status ?? ""),
    printifyStatus: (o.printify_status as string | null) ?? null,
    totalCents: Number(o.total_cents ?? 0),
    subtotalCents: Number(o.subtotal_cents ?? 0),
    shippingCents:
      o.shipping_cents === null || o.shipping_cents === undefined
        ? null
        : Number(o.shipping_cents),
    taxCents: Number(o.tax_cents ?? 0),
    discountCents: Number(o.discount_cents ?? 0),
    discountCode: (o.discount_code as string | null) ?? null,
    createdAt: String(o.created_at ?? ""),
    customerName: (o.customer_name as string | null) ?? null,
    shippingAddress: {
      address1: addr.address1 as string | undefined,
      address2: addr.address2 as string | undefined,
      city: addr.city as string | undefined,
      state: addr.state as string | undefined,
      postal: addr.postal as string | undefined,
      country: addr.country as string | undefined,
    },
    orderNotes: (o.order_notes as string | null) ?? null,
    trackingNumber: (o.tracking_number as string | null) ?? null,
    trackingUrl: (o.tracking_url as string | null) ?? null,
    items: items.map((it) => ({
      handle: String(it.handle ?? ""),
      title: String(it.title ?? ""),
      variantLabel: String(it.variant_label ?? ""),
      qty: Number(it.qty ?? 1),
      unitPriceCents: Number(it.unit_price_cents ?? 0),
      lineTotalCents: Number(it.line_total_cents ?? 0),
    })),
  };
}

/**
 * Guest order lookup: order number + checkout email must BOTH match
 * (the server answers the same generic 404 otherwise). No session
 * needed, no account created.
 */
export async function guestOrderLookup(
  orderNumber: string,
  email: string
): Promise<SiteOrderDetail> {
  const res = await siteCall<{ order?: Record<string, unknown> }>(
    "/api/guest-order-lookup",
    {
      body: {
        order_number: orderNumber.trim().toUpperCase(),
        email: normalizeEmail(email),
      },
      authed: false,
    }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("Order not found.");
    throw new Error(res.error);
  }
  const o = (res.data.order ?? {}) as Record<string, unknown>;
  // Same payload shape as the signed-in detail endpoint.
  const detail = await (async () => {
    const items = (Array.isArray(o.items) ? o.items : []) as Array<
      Record<string, unknown>
    >;
    const addr = (o.shipping_address ?? {}) as Record<string, unknown>;
    return {
      number: String(o.number ?? orderNumber),
      status: String(o.status ?? ""),
      printifyStatus: (o.printify_status as string | null) ?? null,
      totalCents: Number(o.total_cents ?? 0),
      subtotalCents: Number(o.subtotal_cents ?? 0),
      shippingCents:
        o.shipping_cents === null || o.shipping_cents === undefined
          ? null
          : Number(o.shipping_cents),
      taxCents: Number(o.tax_cents ?? 0),
      discountCents: Number(o.discount_cents ?? 0),
      discountCode: (o.discount_code as string | null) ?? null,
      createdAt: String(o.created_at ?? ""),
      customerName: (o.customer_name as string | null) ?? null,
      shippingAddress: {
        address1: addr.address1 as string | undefined,
        address2: addr.address2 as string | undefined,
        city: addr.city as string | undefined,
        state: addr.state as string | undefined,
        postal: addr.postal as string | undefined,
        country: addr.country as string | undefined,
      },
      orderNotes: (o.order_notes as string | null) ?? null,
      trackingNumber: (o.tracking_number as string | null) ?? null,
      trackingUrl: (o.tracking_url as string | null) ?? null,
      items: items.map((it) => ({
        handle: String(it.handle ?? ""),
        title: String(it.title ?? ""),
        variantLabel: String(it.variant_label ?? ""),
        qty: Number(it.qty ?? 1),
        unitPriceCents: Number(it.unit_price_cents ?? 0),
        lineTotalCents: Number(it.line_total_cents ?? 0),
      })),
    };
  })();
  return detail;
}

/**
 * The signed-in account's affiliate record, or null when no affiliate
 * is linked to that email (join state). Joining is temporarily
 * disabled on the site — no join flow is built here.
 */
export async function fetchSiteAffiliate(): Promise<SiteAffiliate | null> {
  const res = await siteCall<{ affiliate?: Record<string, unknown> | null }>(
    "/api/account/affiliate",
    { method: "GET" }
  );
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error(res.error);
  }
  const a = res.data.affiliate;
  if (!a) return null;
  const orders = (Array.isArray(a.orders) ? a.orders : []) as Array<
    Record<string, unknown>
  >;
  const payouts = (Array.isArray(a.payouts) ? a.payouts : []) as Array<
    Record<string, unknown>
  >;
  return {
    code: String(a.code ?? ""),
    link: String(a.link ?? ""),
    rate: String(a.rate ?? ""),
    rateBasisPoints: Number(a.rate_basis_points ?? 0),
    totalEarningsCents: Number(a.total_earnings_cents ?? 0),
    totalEarnings: String(a.total_earnings ?? ""),
    orders: orders.map((o) => ({
      order_number: String(o.order_number ?? ""),
      date: String(o.date ?? ""),
      commission_cents: Number(o.commission_cents ?? 0),
      commission: String(o.commission ?? ""),
      status: String(o.status ?? ""),
    })),
    payouts: payouts.map((p) => ({
      amount_cents: Number(p.amount_cents ?? 0),
      amount: String(p.amount ?? ""),
      status: String(p.status ?? ""),
      created_at: String(p.created_at ?? ""),
      note: String(p.note ?? ""),
    })),
    name: (a.name as string | null) ?? null,
    paymentMethod: (a.payment_method as string | null) ?? null,
    paymentHandle: (a.payment_handle as string | null) ?? null,
  };
}

/**
 * Site forgot-password: always the same generic success (the server
 * never reveals whether the email has an account). The reset link is
 * emailed and opens the SITE in the browser — the shopper resets
 * there, then logs in here. No code, no in-app reset form.
 */
export async function requestForgotPassword(
  email: string
): Promise<{ ok: boolean; message: string }> {
  const res = await siteCall<{ message?: string }>("/api/account/forgot-password", {
    body: { email: normalizeEmail(email) },
    authed: false,
  });
  if (!res.ok) {
    return { ok: false, message: res.error };
  }
  return {
    ok: true,
    message:
      res.data.message ??
      "If an account exists for that email, you will receive a password reset link.",
  };
}

/**
 * Posts a newly added local address to the site best-effort (only
 * when a session token exists). Returns false when skipped or failed
 * — the local address still saves; the site copy is a bonus, never a
 * blocker. Edits/deletes are not posted (no site id is tracked).
 */
export async function addSiteAddress(
  address: LocalAddress
): Promise<boolean> {
  if (!(await getSessionToken())) return false;
  const res = await siteCall("/api/account/addresses", {
    body: {
      label: address.label,
      name: address.name,
      address1: address.street,
      address2: address.street2,
      city: address.city,
      state: address.province,
      postal: address.zip,
      country: address.country,
      is_default: address.isDefault,
    },
  });
  return res.ok;
}
