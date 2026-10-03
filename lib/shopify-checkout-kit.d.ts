/**
 * Local type declarations for @shopify/checkout-sheet-kit.
 *
 * The package points its `types` at a TypeScript source file that doesn't
 * compile under this project's tsconfig, so tsconfig `paths` redirects the
 * import here instead. (Runtime resolution is unaffected — Metro still
 * loads the real JS from the package's lib/commonjs build.)
 */

export interface CheckoutCompletedEvent {
  orderDetails?: { id?: string } | null;
}

export type CheckoutEventSubscription = { remove: () => void } | undefined;

export class ShopifyCheckoutSheet {
  constructor();
  setConfig(config: Record<string, unknown>): void;
  preload(checkoutURL: string): void;
  present(checkoutURL: string): void;
  addEventListener(
    event: "completed",
    cb: (event: CheckoutCompletedEvent | null) => void
  ): CheckoutEventSubscription;
  addEventListener(
    event: string,
    cb: (...args: unknown[]) => void
  ): CheckoutEventSubscription;
}

export declare const ColorScheme: {
  automatic: string;
  light: string;
  dark: string;
  web: string;
};
