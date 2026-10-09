/**
 * Checkout mode (live vs owner-only test).
 *
 * Default is LIVE for everyone. When the signed-in Shopify account is
 * the OWNER's email and the owner flips the hidden "Checkout test mode"
 * switch in App Settings, checkout resolves to the TEST worker + Stripe
 * test publishable key, so full test orders (4242 card, decline cards,
 * refunds) run end-to-end with no real money moving. Test orders land
 * in Shopify tagged "app-checkout-test" (worker ORDER_TAG) so they're
 * easy to spot and cancel; they should be cancelled right after a test.
 *
 * The mode flag lives in AsyncStorage; the signed-in email is re-read
 * from the stored Shopify session, so signing out (or signing in as
 * anyone else) always falls back to live.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import {
  CHECKOUT_WORKER_URL,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_TEST_PUBLISHABLE_KEY,
  TEST_CHECKOUT_WORKER_URL,
} from "./checkoutConfig";
import { getStoredSession } from "./customer";

/** Accounts that may see/arm checkout test mode. */
export const OWNER_EMAILS = ["joeeygabay@gmail.com"];

const MODE_KEY = "beatrackfam-checkout-test-mode";

export interface CheckoutRuntime {
  workerUrl: string;
  publishableKey: string;
  testMode: boolean;
  /** Both a live-legal key and a worker URL are present. */
  configured: boolean;
}

/** True once a test publishable key + test worker URL are filled in. */
export const isTestCheckoutConfigured = () =>
  STRIPE_TEST_PUBLISHABLE_KEY.trim().length > 10 &&
  TEST_CHECKOUT_WORKER_URL.trim().length > 0;

export const isOwnerEmail = (email?: string | null): boolean =>
  !!email && OWNER_EMAILS.includes(email.trim().toLowerCase());

let testFlag = false;
let sessionEmail: string | null = null;
let snapshot: CheckoutRuntime = compute();
const listeners = new Set<() => void>();

function compute(): CheckoutRuntime {
  const testMode =
    testFlag && isOwnerEmail(sessionEmail) && isTestCheckoutConfigured();
  return testMode
    ? {
        workerUrl: TEST_CHECKOUT_WORKER_URL.trim(),
        publishableKey: STRIPE_TEST_PUBLISHABLE_KEY.trim(),
        testMode: true,
        configured: true,
      }
    : {
        workerUrl: CHECKOUT_WORKER_URL,
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        testMode: false,
        configured:
          STRIPE_PUBLISHABLE_KEY.trim().length > 10 &&
          CHECKOUT_WORKER_URL.trim().length > 0,
      };
}

function recompute() {
  const next = compute();
  if (JSON.stringify(next) !== JSON.stringify(snapshot)) snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Load the persisted flag + the current signed-in email. Call at launch. */
export async function hydrateCheckoutMode(): Promise<void> {
  try {
    const [flagRaw, session] = await Promise.all([
      AsyncStorage.getItem(MODE_KEY),
      getStoredSession().catch(() => null),
    ]);
    testFlag = flagRaw === "1";
    sessionEmail = session?.customer?.email ?? null;
  } catch {
    // Defaults (live) already in place.
  }
  recompute();
}

/** Re-read the signed-in email (after sign-in/out) and re-resolve. */
export async function refreshCheckoutSessionEmail(): Promise<void> {
  const session = await getStoredSession().catch(() => null);
  sessionEmail = session?.customer?.email ?? null;
  recompute();
}

/** Flip the owner's persisted test-mode flag. */
export async function setCheckoutTestMode(on: boolean): Promise<void> {
  testFlag = on;
  recompute();
  try {
    await AsyncStorage.setItem(MODE_KEY, on ? "1" : "0");
  } catch {
    // In-memory flag still applies for this session.
  }
}

/** Current runtime for non-hook code (checkout client). */
export function resolveCheckoutRuntime(): CheckoutRuntime {
  return snapshot;
}

/** Reactive runtime for components (layout, checkout, settings). */
export function useCheckoutRuntime(): CheckoutRuntime {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  );
}

/** Owner/settings-facing state: raw flag + whether the owner is here. */
export function getCheckoutModeState(): {
  flagOn: boolean;
  owner: boolean;
  testConfigured: boolean;
} {
  return {
    flagOn: testFlag,
    owner: isOwnerEmail(sessionEmail),
    testConfigured: isTestCheckoutConfigured(),
  };
}
