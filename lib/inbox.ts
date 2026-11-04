/**
 * Inbox data layer (12.1.0 redesign, Phase 2).
 *
 * The Inbox is derived entirely from live store data — no backend feed:
 *  - the signed-in customer's site orders with live status
 *    (GET /api/account/me, lib/accounts.ts),
 *  - app-account orders (local receipts + linked site orders,
 *    lib/accounts.ts),
 *  - the newest catalog products as "Just dropped",
 *  - one welcome item.
 *
 * The TopBar bell badge counts items newer than a last-seen timestamp
 * persisted on device; opening the Inbox marks everything seen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchSiteOrderList,
  formatCents,
  siteOrderStatusLabel,
  type AppAccount,
  type LinkedSiteOrder,
  type OrderReceipt,
  type SiteOrderSummary,
} from "./accounts";
import { formatMoney, type Product } from "./shopify";
import { freshLocalReceipts, visibleLinkedOrders } from "./ordersCount";
import { useShop } from "../store/shop";

const LAST_SEEN_KEY = "beatrackfam.inbox.lastSeen";
const WELCOME_KEY = "beatrackfam.inbox.welcomeAt";
/** First run: only the past week lights the bell, not the whole archive. */
const FIRST_RUN_WINDOW_MS = 7 * 24 * 3600 * 1000;
const MAX_ORDER_ITEMS = 10;

/* ------------------------------ Item model ------------------------------ */

export type InboxItemKind = "order" | "drop" | "welcome";

export interface InboxItem {
  id: string;
  kind: InboxItemKind;
  /** Epoch ms the item is dated by (order date, product creation). */
  at: number;
  title: string;
  body: string;
  /** Navigation payloads, mapped to routes by the Inbox screen. */
  orderId?: string;
  orderSource?: "site" | "local";
}

/** Live status label for a site order (re-exported for Bea/Support). */
export const siteStatusLabel = siteOrderStatusLabel;

export function receiptStatusLabel(o: OrderReceipt): string {
  if (o.status === "cancelled") return "Cancelled";
  if (o.status === "cancellation-requested") return "Cancel requested";
  return "Processing";
}

function parseTs(iso: string | undefined | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export interface InboxSources {
  account: AppAccount | null;
  localOrders: OrderReceipt[];
  linkedOrders: LinkedSiteOrder[];
  siteOrders: SiteOrderSummary[];
  products: Product[];
  welcomeAt: number;
}

export function buildInboxItems(src: InboxSources): InboxItem[] {
  const items: InboxItem[] = [];

  items.push({
    id: "welcome",
    kind: "welcome",
    at: src.welcomeAt,
    title: "Welcome to the Fam",
    body: "This is your Inbox — order updates, fresh drops and Fam-only announcements land right here. Loyalty above all.",
  });

  const orderItems: InboxItem[] = [];

  for (const o of src.siteOrders) {
    const status = siteStatusLabel(o.status);
    orderItems.push({
      id: `order-sh-${o.number}`,
      kind: "order",
      at: parseTs(o.createdAt),
      title: `Order ${o.number} — ${status}`,
      body: `${formatCents(o.totalCents)} · tap for details & tracking`,
      orderId: o.number,
      orderSource: "site",
    });
  }

  for (const o of visibleLinkedOrders(src.siteOrders, src.linkedOrders)) {
    // live site copy already listed (visibleLinkedOrders dedupes)
    orderItems.push({
      id: `order-lk-${o.number}`,
      kind: "order",
      at: parseTs(o.placedAt),
      title: `Order ${o.number} — ${o.status}`,
      body: `${formatMoney({ amount: o.totalAmount, currencyCode: o.currencyCode })} · linked to your account`,
      // Linked orders are only navigable when the live record is loaded;
      // without it the row is informational.
    });
  }

  // Local receipts whose site twin has arrived are shown once, from
  // the site (same rule as Order History — shared in lib/ordersCount.ts).
  const freshLocal = freshLocalReceipts(src.siteOrders, src.localOrders);
  for (const o of freshLocal) {
    const status = receiptStatusLabel(o);
    orderItems.push({
      id: `order-lo-${o.id}`,
      kind: "order",
      at: parseTs(o.placedAt),
      title: `Order placed — ${status}`,
      body: `${o.itemCount} ${o.itemCount === 1 ? "item" : "items"} · ${formatMoney({ amount: o.totalAmount, currencyCode: o.currencyCode })}`,
      orderId: o.id,
      orderSource: "local",
    });
  }

  orderItems.sort((a, b) => b.at - a.at);
  items.push(...orderItems.slice(0, MAX_ORDER_ITEMS));

  // NOTE: the Cloudflare catalog carries no product creation date,
  // so "Just dropped" items cannot be dated truthfully anymore and are
  // omitted (inventing dates would fake newness and light the bell).
  // If the backend later adds a created date, re-derive drops from it.

  return items.sort((a, b) => b.at - a.at);
}

/* ------------------------------- Grouping ------------------------------- */

export interface InboxGroup {
  label: string;
  items: InboxItem[];
}

const DAY_MS = 24 * 3600 * 1000;

export function groupInboxItems(
  items: InboxItem[],
  unreadAfter: number | null,
  now = Date.now()
): InboxGroup[] {
  const fresh = unreadAfter
    ? items.filter((i) => i.at > unreadAfter)
    : [];
  const rest = items.filter((i) => !fresh.includes(i));
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayStart = startOfDay.getTime();
  const weekStart = todayStart - 6 * DAY_MS;

  const groups: InboxGroup[] = [];
  if (fresh.length > 0) groups.push({ label: "New", items: fresh });
  const buckets: [string, (at: number) => boolean][] = [
    ["Today", (at) => at >= todayStart],
    ["This week", (at) => at >= weekStart],
    ["Earlier", () => true],
  ];
  const remaining = [...rest];
  for (const [label, test] of buckets) {
    const hit = remaining.filter((i) => test(i.at));
    if (hit.length > 0) groups.push({ label, items: hit });
    for (const i of hit) remaining.splice(remaining.indexOf(i), 1);
  }
  return groups;
}

export function timeAgo(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  if (diff < 60 * 1000) return "just now";
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  return new Date(at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* --------------------------- Seen-state storage -------------------------- */

type SeenListener = (at: number) => void;
const seenListeners = new Set<SeenListener>();

function emitSeen(at: number) {
  seenListeners.forEach((l) => l(at));
}

export function onInboxSeen(listener: SeenListener): () => void {
  seenListeners.add(listener);
  return () => {
    seenListeners.delete(listener);
  };
}

export async function getInboxLastSeen(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const initial = Date.now() - FIRST_RUN_WINDOW_MS;
    await AsyncStorage.setItem(LAST_SEEN_KEY, String(initial)).catch(
      () => {}
    );
    return initial;
  } catch {
    return Date.now() - FIRST_RUN_WINDOW_MS;
  }
}

export async function markInboxSeen(at = Date.now()): Promise<void> {
  await AsyncStorage.setItem(LAST_SEEN_KEY, String(at)).catch(() => {});
  emitSeen(at);
}

async function getWelcomeAt(account: AppAccount | null): Promise<number> {
  const signedInAt = parseTs(account?.createdAt);
  if (signedInAt > 0) return signedInAt;
  try {
    const raw = await AsyncStorage.getItem(WELCOME_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const now = Date.now();
    await AsyncStorage.setItem(WELCOME_KEY, String(now)).catch(() => {});
    return now;
  } catch {
    return Date.now();
  }
}

/* --------------------------- Site orders loader -------------------------- */
/**
 * One cached loader shared by TopBar, Inbox, Customer Service and Ask
 * Bea, so opening a few screens doesn't refetch the account record.
 * `refresh` bypasses the cache; failures keep the cached copy (or an
 * empty list when nothing was ever loaded — e.g. no session token yet).
 */
let ordersCache: { orders: SiteOrderSummary[]; at: number } | null = null;
const ORDERS_TTL_MS = 60 * 1000;

export async function loadSiteOrders(
  opts?: { refresh?: boolean }
): Promise<SiteOrderSummary[]> {
  if (
    !opts?.refresh &&
    ordersCache &&
    Date.now() - ordersCache.at < ORDERS_TTL_MS
  ) {
    return ordersCache.orders;
  }
  try {
    const orders = (await fetchSiteOrderList()) ?? [];
    ordersCache = { orders, at: Date.now() };
    return orders;
  } catch {
    return ordersCache?.orders ?? [];
  }
}

/* --------------------------------- Hook --------------------------------- */

export interface UseInbox {
  items: InboxItem[];
  unreadCount: number;
  lastSeen: number | null;
  loading: boolean;
  markAllSeen: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useInbox(): UseInbox {
  const { account, orders: localOrders, products } = useShop();
  const [siteOrders, setSiteOrders] = useState<SiteOrderSummary[]>([]);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [welcomeAt, setWelcomeAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => onInboxSeen((at) => setLastSeen(at)), []);

  const load = useCallback(
    async (refreshOrders = false) => {
      const [orders, seen, welcome] = await Promise.all([
        loadSiteOrders({ refresh: refreshOrders }),
        getInboxLastSeen(),
        getWelcomeAt(account),
      ]);
      if (!mounted.current) return;
      setSiteOrders(orders);
      setLastSeen(seen);
      setWelcomeAt(welcome);
      setLoading(false);
    },
    [account]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<InboxItem[]>(() => {
    if (welcomeAt === null) return [];
    return buildInboxItems({
      account,
      localOrders,
      linkedOrders: account?.linkedSiteOrders ?? [],
      siteOrders,
      products,
      welcomeAt,
    });
  }, [account, localOrders, siteOrders, products, welcomeAt]);

  const unreadCount = useMemo(
    () =>
      lastSeen === null
        ? 0
        : items.filter((i) => i.at > lastSeen).length,
    [items, lastSeen]
  );

  const markAllSeen = useCallback(async () => {
    await markInboxSeen();
    if (mounted.current) setLastSeen(Date.now());
  }, []);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { items, unreadCount, lastSeen, loading, markAllSeen, refresh };
}
