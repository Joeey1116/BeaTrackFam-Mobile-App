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

function graphqlEndpoint(): string {
  return `https://shopify.com/${CUSTOMER_API_CONFIG.shopId}/account/customer/api/2026-01/graphql`;
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
          phone
        }
      }
      orders(first: 20) {
        nodes {
          id
          name
          processedAt
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
    const res = await fetch(graphqlEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Customer Account API expects the access token as a Bearer token.
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: CUSTOMER_QUERY }),
    });
    if (!res.ok) {
      return { ok: false, reason: "Couldn't load your profile from Shopify." };
    }
    const json = (await res.json()) as {
      data?: { customer?: any };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      return { ok: false, reason: json.errors[0].message };
    }
    const c = json.data?.customer;
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
        phone: a.phone ?? null,
      })),
      orders: (c.orders?.nodes ?? []).map((o: any) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        processedAt: String(o.processedAt ?? ""),
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
      totalPrice { amount currencyCode }
      subtotalPrice { amount currencyCode }
      totalShippingPrice { amount currencyCode }
      totalTax { amount currencyCode }
      fulfillmentStatus
      financialStatus
      shippingAddress {
        id firstName lastName address1 address2 city province country zip phone
      }
      lineItems(first: 50) {
        nodes {
          id
          name
          variantTitle
          quantity
          image { url }
          currentPrice { amount currencyCode }
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
    totalPrice: money(o.totalPrice) ?? { amount: "0", currencyCode: "USD" },
    subtotalPrice: money(o.subtotalPrice),
    totalShippingPrice: money(o.totalShippingPrice),
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
          phone: o.shippingAddress.phone ?? null,
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
      const res = await fetch(graphqlEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Match fetchCustomer exactly: the Customer Account API expects the
          // access token as a Bearer <redacted>
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query, variables: { id: orderId } }),
      });
      if (!res.ok) continue;
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
