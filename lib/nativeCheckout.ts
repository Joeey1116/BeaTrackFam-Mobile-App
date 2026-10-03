/**
 * Native in-app checkout via Shopify's Checkout Sheet Kit.
 *
 * Presents Shopify's real checkout (Apple Pay, Google Pay, Shop Pay,
 * PayPal, cards — all of Joey's enabled methods) as a native sheet inside
 * the app instead of kicking the buyer out to a browser. Payment is still
 * processed by Shopify; the app never touches card data.
 *
 * The kit is a native module, so it's loaded with a dynamic import and
 * guarded to native platforms. On web (or if the module isn't available),
 * callers get `false`/a no-op and should fall back to opening the checkout
 * URL in the browser.
 */
import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

type KitModule = typeof import("@shopify/checkout-sheet-kit");
type CheckoutSheet = InstanceType<KitModule["ShopifyCheckoutSheet"]>;

let kitPromise: Promise<CheckoutSheet | null> | null = null;

/**
 * Non-enforcing probe: is the Checkout Sheet Kit actually compiled into
 * this native build? The kit's own JS throws an uncatchable-at-eval
 * LINKING_ERROR at module top level when the native module is missing
 * (e.g. an older dev build loading newer JS), so we must check linkage
 * BEFORE the dynamic import below ever evaluates that module.
 */
function isKitLinked(): boolean {
  if (Platform.OS === "web") return false;
  try {
    return (
      TurboModuleRegistry.get("ShopifyCheckoutSheetKit") != null ||
      NativeModules.ShopifyCheckoutSheetKit != null
    );
  } catch {
    return false;
  }
}

async function loadKit(): Promise<CheckoutSheet | null> {
  if (!isKitLinked()) return null;
  if (!kitPromise) {
    kitPromise = (async () => {
      try {
        // Dynamic import: keeps the native-only module out of the web bundle.
        const mod: KitModule = await import("@shopify/checkout-sheet-kit");
        const kit = new mod.ShopifyCheckoutSheet();
        kit.setConfig({
          colorScheme: mod.ColorScheme.automatic,
          preloading: true,
        });
        return kit;
      } catch {
        // Native module unavailable (e.g. Expo Go) — caller falls back.
        return null;
      }
    })();
  }
  return kitPromise;
}

/**
 * Presents the native checkout sheet for the given checkout URL.
 * Returns true when the sheet was presented, false when the caller
 * should fall back to the browser.
 */
export async function presentNativeCheckout(
  checkoutUrl: string
): Promise<boolean> {
  const kit = await loadKit();
  if (!kit) return false;
  try {
    kit.preload(checkoutUrl);
    kit.present(checkoutUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribes to checkout sheet events. Returns an unsubscribe fn.
 * - completed: the order went through (Shopify order id when available).
 * - failed:    the sheet reported an error — the order did NOT go through.
 * - dismissed: the buyer closed the sheet without completing.
 */
export type CheckoutOutcome =
  | { type: "completed"; orderId: string | null }
  | { type: "failed"; message: string }
  | { type: "dismissed" };

export async function onCheckoutEvent(
  cb: (outcome: CheckoutOutcome) => void
): Promise<() => void> {
  const kit = await loadKit();
  if (!kit) return () => {};
  let done = false;
  const subs = [
    kit.addEventListener("completed", (event) => {
      done = true;
      cb({ type: "completed", orderId: event?.orderDetails?.id ?? null });
    }),
    kit.addEventListener("error", (event) => {
      done = true;
      const message =
        (event as { message?: string } | undefined)?.message ??
        "Checkout ran into a problem.";
      cb({ type: "failed", message });
    }),
    kit.addEventListener("close", () => {
      if (!done) cb({ type: "dismissed" });
    }),
  ];
  return () => subs.forEach((s) => s?.remove());
}

/**
 * Subscribes to the checkout "completed" event. Returns an unsubscribe fn.
 * The callback receives the Shopify order id (or null if unavailable).
 */
export async function onNativeCheckoutCompleted(
  cb: (orderId: string | null) => void
): Promise<() => void> {
  return onCheckoutEvent((outcome) => {
    if (outcome.type === "completed") cb(outcome.orderId);
  });
}
