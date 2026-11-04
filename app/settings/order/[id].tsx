/** Order detail — full receipt view with line items and cancellation.
 *
 * Two kinds of id land here:
 *  - a local receipt id (recorded at in-app checkout) — the original view;
 *  - a site order number (BTF-YYYYMMDD-XXXX) — live detail from
 *    GET /api/account/orders/{number}, with tracking when shipped.
 * The old Shopify detail screen is gone; site orders open here.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../../components/ThemeProvider";
import {
  EmptyState,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
} from "../../../components/ui";
import { formatMoney, useShop } from "../../../store/shop";
import {
  fetchSiteOrderDetail,
  formatCents,
  siteOrderStatusLabel,
  type OrderReceipt,
  type SiteOrderDetail as SiteDetail,
} from "../../../lib/accounts";
import { Radius, Spacing } from "../../../constants/theme";

const CONTACT_EMAIL = "contact@beatrackfam.info";

function shortRef(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/^local-/, "").slice(0, 12);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`;
}

function StatusChip({ status }: { status: string }) {
  const { isDark } = useTheme();
  const cancelled = status === "cancelled" || status === "Cancelled";
  const requested = status === "cancellation-requested";
  // Local receipts use completed/cancelled; site orders pass their
  // display label straight through (Processing, Shipped, …).
  const label = cancelled
    ? "Cancelled"
    : requested
      ? "Cancellation requested"
      : status === "completed"
        ? "Completed"
        : status;
  const fg = cancelled ? "#E5484D" : requested ? "#B7791F" : "#2E9E5B";
  const bg = cancelled
    ? isDark
      ? "#3A2A2A"
      : "#FDECEA"
    : requested
      ? isDark
        ? "#3A3320"
        : "#FBF3D9"
      : isDark
        ? "#1E3A2B"
        : "#E6F6EC";
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function ItemRow({ item }: { item: OrderReceipt["items"][number] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.itemRow, { backgroundColor: colors.surface }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="image-outline" size={22} color={colors.textDim} />
        </View>
      )}
      <View style={styles.itemMain}>
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
          {item.productTitle}
        </Text>
        <Text style={[styles.itemSub, { color: colors.textMuted }]}>
          {item.variantTitle} · Qty {item.quantity}
        </Text>
        <Text style={[styles.itemPrice, { color: colors.text }]}>
          {formatMoney({ amount: item.unitAmount, currencyCode: item.currencyCode })} each
        </Text>
      </View>
      <Text style={[styles.lineTotal, { color: colors.text }]}>
        {formatMoney({
          amount: (Number(item.unitAmount) * item.quantity).toFixed(2),
          currencyCode: item.currencyCode,
        })}
      </Text>
    </View>
  );
}

/** Live site-order detail (BTF-… numbers). Signed-in fetch; on a
 * 401 the gate says to sign in rather than showing a bogus empty page. */
function SiteOrderDetailView({ number }: { number: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSiteOrderDetail(number)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Couldn't load that order.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  if (loading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title={`Order · ${number}`} align="center" showBack />
        <ActivityIndicator color={colors.text} style={styles.gate} />
      </View>
    );
  }

  if (!detail || error) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title={`Order · ${number}`} align="center" showBack />
        <View style={styles.gate}>
          <EmptyState
            icon={<Ionicons name="receipt-outline" size={48} color={colors.textDim} />}
            title="Order not found"
            subtitle={error ?? "This order isn't in your history."}
          />
          <PrimaryButton
            label="Back to Order History"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  const addr = detail.shippingAddress;
  const addrLines = [
    detail.customerName ?? "",
    addr.address1 ?? "",
    addr.address2 ?? "",
    [addr.city ?? "", addr.state ?? "", addr.postal ?? ""]
      .filter(Boolean)
      .join(" "),
    addr.country ?? "",
  ].filter(Boolean);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title={`Order · ${detail.number}`} align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
            <StatusChip status={siteOrderStatusLabel(detail.status)} />
          </View>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Placed {formatDateTime(detail.createdAt)} · live from the store.
          </Text>
          {detail.trackingNumber ? (
            <Text style={[styles.note, { color: colors.textMuted }]}>
              Tracking: {detail.trackingNumber}
            </Text>
          ) : null}
          {detail.trackingUrl ? (
            <OutlineButton
              label="Track Package"
              onPress={() => Linking.openURL(detail.trackingUrl!).catch(() => {})}
            />
          ) : null}
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>
          Items ({detail.items.length} {detail.items.length === 1 ? "line" : "lines"})
        </Text>
        {detail.items.map((item, i) => (
          <View
            key={`${item.handle}-${item.variantLabel}-${i}`}
            style={[styles.itemRow, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceRaised }]}>
              <Ionicons name="image-outline" size={22} color={colors.textDim} />
            </View>
            <View style={styles.itemMain}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.itemSub, { color: colors.textMuted }]}>
                {item.variantLabel} · Qty {item.qty}
              </Text>
              <Text style={[styles.itemPrice, { color: colors.text }]}>
                {formatCents(item.unitPriceCents)} each
              </Text>
            </View>
            <Text style={[styles.lineTotal, { color: colors.text }]}>
              {formatCents(item.lineTotalCents)}
            </Text>
          </View>
        ))}

        <Text style={[styles.heading, { color: colors.text }]}>Summary</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.kv}>
            <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Subtotal</Text>
            <Text style={[styles.kvValue, { color: colors.text }]}>
              {formatCents(detail.subtotalCents)}
            </Text>
          </View>
          {detail.discountCents > 0 && (
            <View style={styles.kv}>
              <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Discount</Text>
              <Text style={[styles.kvValue, { color: colors.text }]}>
                −{formatCents(detail.discountCents)}
              </Text>
            </View>
          )}
          <View style={styles.kv}>
            <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Shipping</Text>
            <Text style={[styles.kvValue, { color: colors.text }]}>
              {detail.shippingCents === null
                ? "—"
                : detail.shippingCents === 0
                  ? "Free"
                  : formatCents(detail.shippingCents)}
            </Text>
          </View>
          {detail.taxCents > 0 && (
            <View style={styles.kv}>
              <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Tax</Text>
              <Text style={[styles.kvValue, { color: colors.text }]}>
                {formatCents(detail.taxCents)}
              </Text>
            </View>
          )}
          <View style={styles.kv}>
            <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Total</Text>
            <Text style={[styles.kvValue, { color: colors.text }]}>
              {formatCents(detail.totalCents)}
            </Text>
          </View>
        </View>

        {addrLines.length > 0 && (
          <>
            <Text style={[styles.heading, { color: colors.text }]}>Shipping To</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {addrLines.map((line) => (
                <Text key={line} style={[styles.note, { color: colors.text }]}>
                  {line}
                </Text>
              ))}
            </View>
          </>
        )}

        <View style={styles.ctas}>
          <OutlineButton
            label="Request Cancellation"
            onPress={() => {
              const subject = encodeURIComponent(`Cancel order ${detail.number}`);
              const body = encodeURIComponent(
                `Hi BeaTrackFam,\n\nPlease cancel my order ${detail.number} (placed ${formatDateTime(detail.createdAt)}, total ${formatCents(detail.totalCents)}).\n\nThanks!`
              );
              Linking.openURL(
                `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
              ).catch(() => {});
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default function OrderDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account, orders, cancelOrder } = useShop();
  const [cancelling, setCancelling] = useState(false);

  const order = orders.find((o) => o.id === id);
  if (!order && typeof id === "string" && id.toUpperCase().startsWith("BTF-")) {
    return <SiteOrderDetailView number={id} />;
  }
  const status = order?.status ?? "completed";

  if (!order) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Order" align="center" showBack />
        <View style={styles.gate}>
          <EmptyState
            icon={<Ionicons name="receipt-outline" size={48} color={colors.textDim} />}
            title="Order not found"
            subtitle="This order isn&apos;t in your history."
          />
        </View>
      </View>
    );
  }

  const items = order.items ?? [];
  const email = order.email || account?.email || "";

  const onCancel = () => {
    Alert.alert(
      "Request cancellation?",
      "We can't cancel an order directly from the app, so this opens an email to us with your order number. Send it and we'll cancel it and refund you from our side — your order stays active until you get our confirmation email.",
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Email the request",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            await cancelOrder(order.id);
            setCancelling(false);
            const subject = encodeURIComponent(
              `Cancel order ${shortRef(order.id)}`
            );
            const body = encodeURIComponent(
              `Hi BeaTrackFam,\n\nPlease cancel my order ${shortRef(order.id)} (placed ${formatDateTime(order.placedAt)}, total ${order.totalAmount} ${order.currencyCode}).\n\nThanks!`
            );
            Linking.openURL(
              `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
            ).catch(() => {});
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title={`Order · ${shortRef(order.id)}`} align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
            <StatusChip status={status} />
          </View>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            This receipt was recorded by the app when your checkout completed.
          </Text>
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>
          Items ({order.itemCount})
        </Text>
        {items.length === 0 ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Item details aren&apos;t available for this order.
          </Text>
        ) : (
          items.map((item, i) => (
            <ItemRow
              key={`${item.productTitle}-${item.variantTitle}-${i}`}
              item={item}
            />
          ))
        )}

        <Text style={[styles.heading, { color: colors.text }]}>Summary</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.kv}>
            <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Total</Text>
            <Text style={[styles.kvValue, { color: colors.text }]}>
              {formatMoney({ amount: order.totalAmount, currencyCode: order.currencyCode })}
            </Text>
          </View>
          <View style={styles.kv}>
            <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Placed</Text>
            <Text style={[styles.kvValue, { color: colors.text }]}>
              {formatDateTime(order.placedAt)}
            </Text>
          </View>
          {email !== "" && (
            <View style={styles.kv}>
              <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Email</Text>
              <Text style={[styles.kvValue, { color: colors.text }]}>{email}</Text>
            </View>
          )}
          <View style={styles.kv}>
            <Text style={[styles.kvLabel, { color: colors.textMuted }]}>Reference</Text>
            <Text style={[styles.kvValue, { color: colors.text }]}>{shortRef(order.id)}</Text>
          </View>
        </View>

        {status === "completed" ? (
          <View style={styles.ctas}>
            <OutlineButton
              label={cancelling ? "Sending…" : "Request cancellation"}
              onPress={onCancel}
            />
          </View>
        ) : status === "cancellation-requested" ? (
          <>
            <Text style={[styles.note, { color: colors.textMuted }]}>
              Cancellation requested — you&apos;ll get a confirmation email from us
              once it&apos;s processed.
            </Text>
            <View style={styles.ctas}>
              <PrimaryButton
                label="Back to Order History"
                onPress={() => router.back()}
              />
            </View>
          </>
        ) : (
          <View style={styles.ctas}>
            <PrimaryButton
              label="Back to Order History"
              onPress={() => router.back()}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  gate: { flex: 1, justifyContent: "center", padding: Spacing.lg },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  card: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  heading: { fontSize: 16, fontWeight: "800", marginTop: Spacing.sm },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 19 },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontWeight: "800" },
  itemRow: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    gap: Spacing.md,
    alignItems: "center",
  },
  thumb: { width: 64, height: 64, borderRadius: Radius.md },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  itemMain: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  itemSub: { fontSize: 13 },
  itemPrice: { fontSize: 13, fontWeight: "600" },
  lineTotal: { fontSize: 14, fontWeight: "800" },
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  kvLabel: { fontSize: 14 },
  kvValue: { fontSize: 14, fontWeight: "700" },
  ctas: { marginTop: Spacing.md },
});
