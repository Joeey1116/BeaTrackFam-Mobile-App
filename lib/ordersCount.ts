/**
 * Shared order-list merge (extracted 12.2.x so Profile, Order History
 * and the Inbox can never drift apart).
 *
 * One customer's orders live in up to three places:
 *  - the site account's live orders (GET /api/account/me,
 *    lib/accounts.ts) — the live record, every status included
 *    (cancelled too);
 *  - site orders the customer linked to their app account
 *    (account.linkedSiteOrders, lib/accounts.ts);
 *  - local in-app receipts (account.orders) placed from this device.
 *
 * Merge rule (same one Order History renders): a local receipt whose
 * site twin has arrived — same total, placed within ~36h before the
 * site record — is shown once, from the site; the local copy only
 * covers the gap until the twin lands. A linked order that is already
 * in the live site list is likewise one order, not two.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { loadSiteOrders } from "./inbox";
import type {
  LinkedSiteOrder,
  OrderReceipt,
  SiteOrderSummary,
} from "./accounts";
import { useShop } from "../store/shop";

export interface OrderSources {
  siteOrders: SiteOrderSummary[];
  linkedOrders: LinkedSiteOrder[];
  localOrders: OrderReceipt[];
}

/** Local receipts with no site twin yet ("JUST PLACED" in Order History). */
export function freshLocalReceipts(
  siteOrders: SiteOrderSummary[],
  localOrders: OrderReceipt[]
): OrderReceipt[] {
  return localOrders.filter(
    (o) =>
      !siteOrders.some((s) => {
        const sameTotal =
          s.totalCents === Math.round(Number(o.totalAmount) * 100);
        const dt =
          new Date(s.createdAt).getTime() - new Date(o.placedAt).getTime();
        return sameTotal && dt > -36 * 3600 * 1000 && dt < 72 * 3600 * 1000;
      })
  );
}

/** Linked orders not already present in the live site list. */
export function visibleLinkedOrders(
  siteOrders: SiteOrderSummary[],
  linkedOrders: LinkedSiteOrder[]
): LinkedSiteOrder[] {
  const siteNumbers = new Set(siteOrders.map((o) => o.number));
  return linkedOrders.filter((o) => !siteNumbers.has(o.number));
}

/**
 * Total order count exactly as Order History shows it: every live
 * site order (cancelled included — no status filtering), linked
 * orders without a live twin, and local receipts without a twin.
 */
export function mergedOrderCount(src: OrderSources): number {
  return (
    src.siteOrders.length +
    visibleLinkedOrders(src.siteOrders, src.linkedOrders).length +
    freshLocalReceipts(src.siteOrders, src.localOrders).length
  );
}

export interface UseMergedOrderCount {
  /** Merged count once the site orders have loaded. */
  count: number;
  /** True while the first site load is in flight. */
  loading: boolean;
  /** Re-read the site orders fresh (pull-to-refresh). */
  refresh: () => Promise<void>;
}

/**
 * Order count for the Profile member card. Loads the shared site
 * orders whenever the Profile screen focuses (so signing in from
 * Order History and coming back shows the right number).
 *
 * Before the site orders arrive — or when there is no signed-in
 * account at all — the count falls back to what the device already
 * knows (local receipts + linked orders), so a signed-in customer
 * never sees a bogus 0 just because the network is slow.
 */
export function useMergedOrderCount(): UseMergedOrderCount {
  const { account, orders: localOrders } = useShop();
  const linkedOrders = account?.linkedSiteOrders ?? [];
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
      const siteOrders = await loadSiteOrders({ refresh });
      if (!mounted.current) return;
      setMerged(
        mergedOrderCount({
          siteOrders,
          linkedOrders: account?.linkedSiteOrders ?? [],
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
    siteOrders: [],
    linkedOrders,
    localOrders,
  });

  return { count: merged ?? fallback, loading, refresh };
}
