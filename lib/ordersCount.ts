/**
 * Shared order-list merge (extracted 12.2.x so Profile, Order History
 * and the Inbox can never drift apart).
 *
 * One customer's orders live in up to three places:
 *  - Shopify Customer Account API session orders (lib/customer.ts) —
 *    the live record, every status included (cancelled too);
 *  - guest orders the customer linked to their app account
 *    (account.linkedShopifyOrders, lib/accounts.ts);
 *  - local in-app receipts (account.orders) placed from this device.
 *
 * Merge rule (same one Order History renders): a local receipt whose
 * Shopify twin has arrived — same total, placed within ~36h before the
 * Shopify record — is shown once, from Shopify; the local copy only
 * covers the gap until the twin lands. A linked order that is already
 * in the live Shopify list is likewise one order, not two.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { loadShopifySession } from "./inbox";
import type { CustomerOrder } from "./customer";
import type { LinkedShopifyOrder, OrderReceipt } from "./accounts";
import { useShop } from "../store/shop";

export interface OrderSources {
  shopifyOrders: CustomerOrder[];
  linkedOrders: LinkedShopifyOrder[];
  localOrders: OrderReceipt[];
}

/** Local receipts with no Shopify twin yet ("JUST PLACED" in Order History). */
export function freshLocalReceipts(
  shopifyOrders: CustomerOrder[],
  localOrders: OrderReceipt[]
): OrderReceipt[] {
  return localOrders.filter(
    (o) =>
      !shopifyOrders.some((s) => {
        const sameTotal =
          Number(s.totalPrice.amount) === Number(o.totalAmount) &&
          s.totalPrice.currencyCode === o.currencyCode;
        const dt =
          new Date(s.processedAt).getTime() - new Date(o.placedAt).getTime();
        return sameTotal && dt > -36 * 3600 * 1000 && dt < 72 * 3600 * 1000;
      })
  );
}

/** Linked orders not already present in the live Shopify list. */
export function visibleLinkedOrders(
  shopifyOrders: CustomerOrder[],
  linkedOrders: LinkedShopifyOrder[]
): LinkedShopifyOrder[] {
  const shopifyIds = new Set(shopifyOrders.map((o) => o.id));
  return linkedOrders.filter((o) => !shopifyIds.has(o.id));
}

/**
 * Total order count exactly as Order History shows it: every Shopify
 * session order (cancelled included — no status filtering), linked
 * orders without a live twin, and local receipts without a twin.
 */
export function mergedOrderCount(src: OrderSources): number {
  return (
    src.shopifyOrders.length +
    visibleLinkedOrders(src.shopifyOrders, src.linkedOrders).length +
    freshLocalReceipts(src.shopifyOrders, src.localOrders).length
  );
}

export interface UseMergedOrderCount {
  /** Merged count once the Shopify session has loaded. */
  count: number;
  /** True while the first session load is in flight. */
  loading: boolean;
  /** Re-read the session fresh from Shopify (pull-to-refresh). */
  refresh: () => Promise<void>;
}

/**
 * Order count for the Profile member card. Loads the shared Shopify
 * session whenever the Profile screen focuses (so signing in from
 * Order History and coming back shows the right number), refreshing
 * the customer record from Shopify so statuses stay live.
 *
 * Before the session arrives — or when there is no Shopify sign-in at
 * all — the count falls back to what the device already knows (local
 * receipts + linked orders), so a signed-in customer never sees a
 * bogus 0 just because the network is slow.
 */
export function useMergedOrderCount(): UseMergedOrderCount {
  const { account, orders: localOrders } = useShop();
  const linkedOrders = account?.linkedShopifyOrders ?? [];
  const [merged, setMerged] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (refresh: boolean) => {
      const session = await loadShopifySession({ refresh });
      if (!mounted.current) return;
      setMerged(
        mergedOrderCount({
          shopifyOrders: session?.customer.orders ?? [],
          linkedOrders: account?.linkedShopifyOrders ?? [],
          localOrders,
        })
      );
      setLoading(false);
    },
    [account, localOrders]
  );

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load])
  );

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const fallback = mergedOrderCount({
    shopifyOrders: [],
    linkedOrders,
    localOrders,
  });

  return { count: merged ?? fallback, loading, refresh };
}
