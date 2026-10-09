/**
 * Shopify Customer Account API seam — DEPRECATED FOR SIGN-IN (Oct 2026).
 *
 * The Customer Account API's OAuth + profile fetch kept failing on real
 * devices ("Couldn't load your profile from Shopify"), which blocked
 * sign-in entirely. Sign-in now uses device-local app accounts
 * (lib/accounts.ts) and NEVER calls startLogin()/fetchCustomer().
 *
 * This module is kept for the LOCAL PROFILE types + storage below
 * (LocalProfile, LocalAddress, getLocalProfile, saveLocalProfile), which
 * the account system builds on. Do not reintroduce the OAuth flow into
 * the login/signup UI without a verified end-to-end device test.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";

export const CUSTOMER_API_CONFIG = {
  /** Client ID of Joey's "Gabi Assistant" custom app (wired Oct 1 2026). */
  clientId: "50aefe82-7b8a-4fee-a25c-793a2c3e458e", // Customer Account API Mobile client (UUID format)
  /** Shop ID (verified Oct 1 2026 from the store's /account/login redirect). */
  shopId: "76755992730",
  /**
   * Override for the OAuth redirect URI. Leave empty to use the app's
   * default (`shop.{shopId}.auth://callback`). Whatever is used MUST be registered in
   * the Headless app's redirect URI allow-list.
   */
  redirectUri: "",
};

export function isCustomerApiConfigured(): boolean {
  return (
    CUSTOMER_API_CONFIG.clientId.trim().length > 0 &&
    CUSTOMER_API_CONFIG.shopId.trim().length > 0
  );
}

const SESSION_KEY = "beatrackfam-customer-session";

/* ---------------------------------- Types ---------------------------------- */

export interface CustomerAddress {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
}

export interface CustomerOrder {
  cancelledAt?: string | null;
  id: string;
  name: string;
  processedAt: string;
  totalPrice: { amount: string; currencyCode: string };
  fulfillmentStatus?: string | null;
  financialStatus?: string | null;
}

export interface CustomerOrderLineItem {
  id: string;
  name: string;
  variantTitle?: string | null;
  quantity: number;
  imageUrl?: string | null;
  price?: { amount: string; currencyCode: string } | null;
}

export interface CustomerTracking {
  company?: string | null;
  number?: string | null;
  url?: string | null;
}

export interface CustomerFulfillment {
  status?: string | null;
  tracking: CustomerTracking[];
}

export interface CustomerOrderDetail extends CustomerOrder {
  subtotalPrice?: { amount: string; currencyCode: string } | null;
  totalShippingPrice?: { amount: string; currencyCode: string } | null;
  totalTax?: { amount: string; currencyCode: string } | null;
  shippingAddress?: CustomerAddress | null;
  lineItems: CustomerOrderLineItem[];
  fulfillments: CustomerFulfillment[];
}

export interface Customer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  addresses: CustomerAddress[];
  orders: CustomerOrder[];
}

export interface CustomerSession {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt: number;
  customer: Customer;
}

export type LoginResult =
  | { ok: true; session: CustomerSession }
  | { ok: false; reason: string; notConfigured?: boolean };

/* --------------------------------- OAuth ----------------------------------- */

function authorizeEndpoint(): string {
  return `https://shopify.com/authentication/${CUSTOMER_API_CONFIG.shopId}/oauth/authorize`;
}

function tokenEndpoint(): string {
  return `https://shopify.com/authentication/${CUSTOMER_API_CONFIG.shopId}/oauth/token`;
}

function fallbackGraphqlEndpoint(): string {
  return `https://shopify.com/${CUSTOMER_API_CONFIG.shopId}/account/customer/api/2026-10/graphql`;
}

// Discover the Customer Account API GraphQL endpoint at runtime (Shopify's
// requirement — never hardcode it). Cached for the app's lifetime; falls
// back to a current known endpoint if discovery is unreachable.
let discoveredEndpointPromise: Promise<string> | null = null;
function graphqlEndpoint(): Promise<string> {
  if (!discoveredEndpointPromise) {
    discoveredEndpointPromise = (async () => {
      try {
        const res = await fetch(
          `https://rp4j61-zf.myshopify.com/.well-known/customer-account-api`,
          { headers: { "user-agent": "BeaTrackFam-App" } }
        );
        const json = (await res.json()) as { graphql_api?: string };
        return json.graphql_api?.trim()
          ? json.graphql_api.trim()
          : fallbackGraphqlEndpoint();
      } catch {
        return fallbackGraphqlEndpoint();
      }
    })();
  }
  return discoveredEndpointPromise;
}

function resolveRedirectUri(): string {
  const override = CUSTOMER_API_CONFIG.redirectUri.trim();
  if (override) return override;
  if (Platform.OS === "web" && typeof window !== "undefined")
    return window.location.origin;
  // Shopify requires mobile callback URLs to use the `shop.{shop_id}.*`
  // custom scheme (Customer Account API docs). This exact value must be
  // registered as a Callback URI in the API's Application setup.
  return `shop.${CUSTOMER_API_CONFIG.shopId}.auth://callback`;
}


/**
 * Runs the full Customer Account API OAuth flow:
 * authorize (PKCE) → browser session → token exchange → customer GraphQL.
 * Never throws — failures return `{ ok: false, reason }`.
 */
export async function startLogin(): Promise<LoginResult> {
  if (!isCustomerApiConfigured()) {
    return {
      ok: false,
      notConfigured: true,
      reason:
        "Shopify sign-in isn't connected yet — the store owner needs to finish a quick free setup in the Shopify admin.",
    };
  }

  try {
    WebBrowser.maybeCompleteAuthSession();
    const redirectUri = resolveRedirectUri();

    const request = new AuthSession.AuthRequest({
      clientId: CUSTOMER_API_CONFIG.clientId,
      redirectUri,
      scopes: ["openid", "email", "customer-account-api:full"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });
    const discovery = {
      authorizationEndpoint: authorizeEndpoint(),
      tokenEndpoint: tokenEndpoint(),
    };
    const result = await request.promptAsync(discovery);

    if (result.type === "cancel") {
      return { ok: false, reason: "Sign-in was cancelled." };
    }
    if (result.type !== "success") {
      return {
        ok: false,
        reason: "Sign-in didn't complete. Please try again.",
      };
    }
    const code = result.params.code;
    const error = result.params.error;
    if (error) {
      return { ok: false, reason: `Shopify sign-in failed (${error}).` };
    }
    if (!code || !request.codeVerifier) {
      return {
        ok: false,
        reason: "Sign-in verification failed. Please try again.",
      };
    }

    let tokens: AuthSession.TokenResponse;
    try {
      tokens = await AuthSession.exchangeCodeAsync(
        {
          clientId: CUSTOMER_API_CONFIG.clientId,
          code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        { tokenEndpoint: tokenEndpoint() }
      );
    } catch {
      return {
        ok: false,
        reason: "Couldn't exchange the sign-in code. Please try again.",
      };
    }

    const accessToken = tokens.accessToken;
    if (!accessToken) {
      return { ok: false, reason: "Shopify didn't return an access token." };
    }
    const expiresAt =
      Date.now() + (tokens.expiresIn ? tokens.expiresIn * 1000 : 3600 * 1000);

    const customerResult = await fetchCustomer(accessToken);
    if (!customerResult.ok) {
      return { ok: false, reason: customerResult.reason };
    }

    const session: CustomerSession = {
      accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      customer: customerResult.customer,
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Sign-in failed unexpectedly.",
    };
  }
}

/* ------------------------------- Customer API ------------------------------ */

// Shopify rejects Customer Account API GraphQL calls that lack an `Origin`
// header whose value is registered for the client (missing -> 401
// invalid_token) or a `user-agent` header (missing -> 403). That was the
// root cause of the Oct 1, 2026 "Couldn't load your profile from Shopify"
// failure. Try the shop's registered origins in order and cache the one
// Shopify accepts so later calls go straight to it.
const ORIGIN_CANDIDATES = [
  "https://beatrackfam.info",
  "https://rp4j61-zf.myshopify.com",
];
let workingOrigin: string | null = null;
let workingAuthForm: "bearer" | "raw" | null = null;

async function customerApiFetch(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response | null> {
  const origins = workingOrigin
    ? [workingOrigin, ...ORIGIN_CANDIDATES.filter((o) => o !== workingOrigin)]
    : ORIGIN_CANDIDATES;
  const authForms: ("bearer" | "raw")[] = workingAuthForm
    ? [workingAuthForm, workingAuthForm === "bearer" ? "raw" : "bearer"]
    : ["bearer", "raw"];
  let lastRes: Response | null = null;
  for (const form of authForms) {
    for (const origin of origins) {
      try {
        const res = await fetch(await graphqlEndpoint(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Shopify's Customer Account API is inconsistent across client
            // types about `Bearer ` vs the raw token, so we try both and
            // cache the form Shopify accepts.
            Authorization:
              form === "bearer" ? `Bearer ${accessToken}` : accessToken,
            Origin: origin,
            "user-agent": "BeaTrackFam-App",
          },
          body: JSON.stringify(body),
        });
        lastRes = res;
        if (res.ok) {
          workingOrigin = origin;
          workingAuthForm = form;
          return res;
        }
        // 401 (Origin/token rejected) / 403 (header rejected): try the next
        // combination instead of giving up.
        if (res.status !== 401 && res.status !== 403) return res;
      } catch {
        return null;
      }
    }
  }
  return lastRes;
}

const CUSTOMER_QUERY = `
  query CustomerProfile {
    customer {
      id
      firstName
      lastName
      emailAddress { emailAddress }
      phoneNumber { phoneNumber }
      addresses(first: 20) {
        nodes {
          id
          firstName
          lastName
          address1
          address2
          city
          province
          country
          zip
          phoneNumber
        }
      }
      orders(first: 20) {
        nodes {
          id
          name
          processedAt
          cancelledAt
          totalPrice { amount currencyCode }
          fulfillmentStatus
        }
      }
    }
  }
`;

export async function fetchCustomer(
  accessToken: string
): Promise<{ ok: true; customer: Customer } | { ok: false; reason: string }> {
  try {
    const res = await customerApiFetch(accessToken, {
      query: CUSTOMER_QUERY,
    });
    if (!res) {
      return {
        ok: false,
        reason: "Couldn't reach Shopify — check your connection and try again.",
      };
    }
    const json = (await res
      .json()
      .catch(() => null)) as {
      data?: { customer?: any };
      errors?: { message: string }[];
    } | null;
    if (!res.ok) {
      // Shopify explains most failures in the errors[] body even on 4xx —
      // surface that sentence instead of a bare status code.
      if (json?.errors?.length) {
        return { ok: false, reason: json.errors[0].message };
      }
      return {
        ok: false,
        reason: `Couldn't load your profile from Shopify (error ${res.status}).`,
      };
    }
    if (json?.errors?.length) {
      return { ok: false, reason: json.errors[0].message };
    }
    const c = json?.data?.customer;
    if (!c) {
      return { ok: false, reason: "No customer found for this sign-in." };
    }
    const customer: Customer = {
      id: String(c.id ?? ""),
      firstName: c.firstName ?? null,
      lastName: c.lastName ?? null,
      email: c.emailAddress?.emailAddress ?? null,
      phone: c.phoneNumber?.phoneNumber ?? null,
      addresses: (c.addresses?.nodes ?? []).map((a: any) => ({
        id: String(a.id ?? ""),
        firstName: a.firstName ?? null,
        lastName: a.lastName ?? null,
        address1: a.address1 ?? null,
        address2: a.address2 ?? null,
        city: a.city ?? null,
        province: a.province ?? null,
        country: a.country ?? null,
        zip: a.zip ?? null,
        phone: a.phoneNumber ?? null,
      })),
      orders: (c.orders?.nodes ?? []).map((o: any) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        processedAt: String(o.processedAt ?? ""),
        cancelledAt: o.cancelledAt ?? null,
        totalPrice: {
          amount: String(o.totalPrice?.amount ?? "0"),
          currencyCode: String(o.totalPrice?.currencyCode ?? "USD"),
        },
        fulfillmentStatus: o.fulfillmentStatus ?? null,
      })),
    };
    return { ok: true, customer };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Couldn't load your profile.",
    };
  }
}

const ORDER_DETAIL_RICH = `
  query OrderDetail($id: ID!) {
    order(id: $id) {
      id
      name
      processedAt
      cancelledAt
      totalPrice { amount currencyCode }
      subtotal { amount currencyCode }
      totalShipping { amount currencyCode }
      totalTax { amount currencyCode }
      fulfillmentStatus
      financialStatus
      shippingAddress {
        id firstName lastName address1 address2 city province country zip phoneNumber
      }
      lineItems(first: 50) {
        nodes {
          id
          name
          variantTitle
          quantity
          image { url }
          price { amount currencyCode }
        }
      }
      fulfillments(first: 10) {
        nodes {
          status
          trackingInformation { company number url }
        }
      }
    }
  }
`;

const ORDER_DETAIL_BASIC = `
  query OrderDetail($id: ID!) {
    order(id: $id) {
      id
      name
      processedAt
      cancelledAt
      totalPrice { amount currencyCode }
      fulfillmentStatus
      financialStatus
      lineItems(first: 50) {
        nodes { id name variantTitle quantity image { url } }
      }
    }
  }
`;

function money(m: any): { amount: string; currencyCode: string } | null {
  if (!m) return null;
  return {
    amount: String(m.amount ?? "0"),
    currencyCode: String(m.currencyCode ?? "USD"),
  };
}

function mapOrderDetail(o: any): CustomerOrderDetail {
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? ""),
    processedAt: String(o.processedAt ?? ""),
    cancelledAt: o.cancelledAt ?? null,
    totalPrice: money(o.totalPrice) ?? { amount: "0", currencyCode: "USD" },
    subtotalPrice: money(o.subtotal),
    totalShippingPrice: money(o.totalShipping),
    totalTax: money(o.totalTax),
    fulfillmentStatus: o.fulfillmentStatus ?? null,
    financialStatus: o.financialStatus ?? null,
    shippingAddress: o.shippingAddress
      ? {
          id: String(o.shippingAddress.id ?? ""),
          firstName: o.shippingAddress.firstName ?? null,
          lastName: o.shippingAddress.lastName ?? null,
          address1: o.shippingAddress.address1 ?? null,
          address2: o.shippingAddress.address2 ?? null,
          city: o.shippingAddress.city ?? null,
          province: o.shippingAddress.province ?? null,
          country: o.shippingAddress.country ?? null,
          zip: o.shippingAddress.zip ?? null,
          phone: o.shippingAddress.phoneNumber ?? null,
        }
      : null,
    lineItems: (o.lineItems?.nodes ?? []).map((li: any) => ({
      id: String(li.id ?? ""),
      name: String(li.name ?? ""),
      variantTitle: li.variantTitle ?? null,
      quantity: Number(li.quantity ?? 1),
      imageUrl: li.image?.url ?? null,
      price: money(li.currentPrice),
    })),
    fulfillments: (o.fulfillments?.nodes ?? []).map((f: any) => ({
      status: f.status ?? null,
      tracking: (f.trackingInformation ?? []).map((t: any) => ({
        company: t.company ?? null,
        number: t.number ?? null,
        url: t.url ?? null,
      })),
    })),
  };
}

/**
 * Fetches one order's full detail (line items, address, tracking) from the
 * Customer Account API. Tries the rich selection first and falls back to a
 * minimal one so a missing field never blanks the whole screen.
 */
export async function fetchOrderDetail(
  accessToken: string,
  orderId: string
): Promise<{ ok: true; order: CustomerOrderDetail } | { ok: false; reason: string }> {
  for (const query of [ORDER_DETAIL_RICH, ORDER_DETAIL_BASIC]) {
    try {
      const res = await customerApiFetch(accessToken, {
        query,
        variables: { id: orderId },
      });
      if (!res || !res.ok) continue;
      const json = (await res.json()) as {
        data?: { order?: any };
        errors?: { message: string }[];
      };
      if (json.errors?.length || !json.data?.order) continue;
      return { ok: true, order: mapOrderDetail(json.data.order) };
    } catch {
      continue;
    }
  }
  return { ok: false, reason: "Couldn't load this order. Pull to try again." };
}

/** Refreshes the stored session's customer data (profile, orders). */
export async function refreshSessionCustomer(
  session: CustomerSession
): Promise<CustomerSession> {
  if (Date.now() >= session.expiresAt) return session;
  const result = await fetchCustomer(session.accessToken);
  if (!result.ok) return session;
  const next: CustomerSession = { ...session, customer: result.customer };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

/* --------------------------------- Storage --------------------------------- */

export async function getStoredSession(): Promise<CustomerSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CustomerSession;
    if (!session.accessToken || Date.now() >= session.expiresAt) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
}

/**
 * Ends the Shopify *browser* session too. Clearing the app's stored token is
 * not enough to switch emails: the hosted sign-in lives in Safari's cookie
 * jar, so Shopify silently signs the same account back in. Opening
 * Shopify's end-session endpoint in the browser kills that session, and the
 * next "Continue with email" shows the email form again.
 */
export async function signOutOfShopify(idToken?: string): Promise<void> {
  const base = `https://shopify.com/authentication/${CUSTOMER_API_CONFIG.shopId}/logout`;
  const url = idToken ? `${base}?id_token_hint=${encodeURIComponent(idToken)}` : base;
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    /* best effort — the local session is already cleared */
  }
}

/* ------------------------------ Local profile ------------------------------ */
/* Profile extras Shopify doesn't natively store (interests, socials, avatar,
   device-local address drafts) — persisted on the device only. */

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
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(() => {});
}

export async function clearLocalProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY).catch(() => {});
}
