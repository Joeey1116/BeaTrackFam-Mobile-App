/** Shopify order detail — full receipt with line items, live fulfillment
 * status, tracking links, and a cancellation request.
 *
 * Cancellation: Shopify's Customer Account API has no customer-side cancel
 * (orderCancel is Admin-only), so the button composes a pre-addressed email
 * to the shop with the order number filled in. The shop processes it and the
 * refund confirmation follows by email. Only offered while unfulfilled.
 */
import React, { useCallback, useEffect, useState } from "react";
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
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../../components/ThemeProvider";
import {
  EmptyState,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SectionLabel,
} from "../../../components/ui";
import { Radius, Spacing } from "../../../constants/theme";
import { formatMoney } from "../../../store/shop";
import {
  fetchOrderDetail,
  getStoredSession,
  type CustomerOrderDetail,
} from "../../../lib/customer";

const CONTACT_EMAIL = "contact@beatrackfam.info";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : `${d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function fulfillLabel(status?: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "FULFILLED":
      return "Shipped";
    case "PARTIALLY_FULFILLED":
      return "Partly shipped";
    case "UNFULFILLED":
      return "Processing";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Processing";
  }
}

function financialLabel(status?: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "PAID":
      return "Paid";
    case "PENDING":
      return "Payment pending";
    case "REFUNDED":
      return "Refunded";
    case "PARTIALLY_REFUNDED":
      return "Partly refunded";
    case "VOIDED":
      return "Voided";
    default:
      return "";
  }
}

export default function ShopifyOrderDetail() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    if (!id) return;
    const session = await getStoredSession();
    if (!session) {
      setError("Sign in from Order History to view this order.");
      setLoading(false);
      return;
    }
    const result = await fetchOrderDetail(session.accessToken, String(id));
    if (result.ok) {
      setOrder(result.order);
      setError(null);
    } else {
      setError(result.reason);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      const session = await getStoredSession();
      if (cancelled) return;
      if (!session) {
        setError("Sign in from Order History to view this order.");
        setLoading(false);
        return;
      }
      const result = await fetchOrderDetail(session.accessToken, String(id));
      if (cancelled) return;
      if (result.ok) {
        setOrder(result.order);
        setError(null);
      } else {
        setError(result.reason);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const requestCancellation = useCallback(() => {
    if (!order) return;
    Alert.alert(
      "Request cancellation?",
      "This opens an email to us with your order number. Send it and we'll cancel it and refund you from our side — your order stays active until you get our confirmation email.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Open email",
          onPress: () => {
            const subject = encodeURIComponent(`Cancel order ${order.name}`);
            const body = encodeURIComponent(
              `Hi BeaTrackFam,\n\nPlease cancel my order ${order.name} (placed ${formatDateTime(order.processedAt)}).\n\nThanks!`
            );
            Linking.openURL(
              `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
            ).catch(() => {});
          },
        },
      ]
    );
  }, [order]);

  if (loading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Order" align="center" showBack />
        <ActivityIndicator color={colors.text} style={styles.spinner} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Order" align="center" showBack />
        <View style={styles.body}>
          <EmptyState
            icon={
              <Ionicons name="alert-circle-outline" size={44} color={colors.textDim} />
            }
            title="Couldn't load this order"
            subtitle={error ?? "Pull back and try again from Order History."}
          />
          <OutlineButton
            label="Try again"
            onPress={() => {
              setLoading(true);
              load();
            }}
          />
        </View>
      </View>
    );
  }

  const cancelled = (order.fulfillmentStatus ?? "").toUpperCase() === "CANCELLED";
  const fulfilled = (order.fulfillmentStatus ?? "").toUpperCase() === "FULFILLED";
  const canRequestCancel = !cancelled && !fulfilled;
  const tracking = order.fulfillments.flatMap((f) => f.tracking);
  const addr = order.shippingAddress;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title={`Order ${order.name}`} align="center" showBack />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.chipRow}>
          <View
            style={[
              styles.chip,
              { backgroundColor: isDark ? "#1E1E22" : "#ECECEF" },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.text }]}>
              {fulfillLabel(order.fulfillmentStatus)}
            </Text>
          </View>
          {financialLabel(order.financialStatus) ? (
            <View
              style={[
                styles.chip,
                { backgroundColor: isDark ? "#1E1E22" : "#ECECEF" },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>
                {financialLabel(order.financialStatus)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.placed, { color: colors.textMuted }]}>
          Placed {formatDateTime(order.processedAt)}
        </Text>

        <SectionLabel text="ITEMS" />
        {order.lineItems.map((li) => (
          <View
            key={li.id}
            style={[
              styles.itemCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {li.imageUrl ? (
              <Image source={{ uri: li.imageUrl }} style={styles.thumb} />
            ) : (
              <View
                style={[
                  styles.thumb,
                  styles.thumbEmpty,
                  { backgroundColor: isDark ? "#1E1E22" : "#ECECEF" },
                ]}
              >
                <Ionicons name="image-outline" size={20} color={colors.textDim} />
              </View>
            )}
            <View style={styles.itemMain}>
              <Text style={[styles.itemName, { color: colors.text }]}>
                {li.name}
              </Text>
              {li.variantTitle ? (
                <Text style={[styles.itemVariant, { color: colors.textMuted }]}>
                  {li.variantTitle}
                </Text>
              ) : null}
              <Text style={[styles.itemVariant, { color: colors.textMuted }]}>
                Qty {li.quantity}
              </Text>
            </View>
            {li.price ? (
              <Text style={[styles.itemPrice, { color: colors.text }]}>
                {formatMoney(li.price)}
              </Text>
            ) : null}
          </View>
        ))}

        {tracking.length > 0 && (
          <>
            <SectionLabel text="TRACKING" />
            {tracking.map((t, i) => (
              <View
                key={i}
                style={[
                  styles.trackCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="cube-outline" size={22} color={colors.text} />
                <View style={styles.itemMain}>
                  <Text style={[styles.itemName, { color: colors.text }]}>
                    {t.company ?? "Carrier"}
                  </Text>
                  {t.number ? (
                    <Text style={[styles.itemVariant, { color: colors.textMuted }]}>
                      {t.number}
                    </Text>
                  ) : null}
                </View>
                {t.url ? (
                  <OutlineButton
                    label="Track package"
                    onPress={() => Linking.openURL(t.url!).catch(() => {})}
                  />
                ) : null}
              </View>
            ))}
          </>
        )}

        {addr && (
          <>
            <SectionLabel text="SHIPPING TO" />
            <View
              style={[
                styles.addrCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.addrLine, { color: colors.text }]}>
                {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}
              </Text>
              {addr.address1 ? (
                <Text style={[styles.addrLine, { color: colors.textMuted }]}>
                  {addr.address1}
                </Text>
              ) : null}
              {addr.address2 ? (
                <Text style={[styles.addrLine, { color: colors.textMuted }]}>
                  {addr.address2}
                </Text>
              ) : null}
              <Text style={[styles.addrLine, { color: colors.textMuted }]}>
                {[addr.city, addr.province, addr.zip].filter(Boolean).join(", ")}
              </Text>
              {addr.country ? (
                <Text style={[styles.addrLine, { color: colors.textMuted }]}>
                  {addr.country}
                </Text>
              ) : null}
            </View>
          </>
        )}

        <SectionLabel text="SUMMARY" />
        <View
          style={[
            styles.addrCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {order.subtotalPrice ? (
            <View style={styles.sumRow}>
              <Text style={[styles.addrLine, { color: colors.textMuted }]}>Subtotal</Text>
              <Text style={[styles.addrLine, { color: colors.text }]}>
                {formatMoney(order.subtotalPrice)}
              </Text>
            </View>
          ) : null}
          {order.totalShippingPrice ? (
            <View style={styles.sumRow}>
              <Text style={[styles.addrLine, { color: colors.textMuted }]}>Shipping</Text>
              <Text style={[styles.addrLine, { color: colors.text }]}>
                {formatMoney(order.totalShippingPrice)}
              </Text>
            </View>
          ) : null}
          {order.totalTax ? (
            <View style={styles.sumRow}>
              <Text style={[styles.addrLine, { color: colors.textMuted }]}>Tax</Text>
              <Text style={[styles.addrLine, { color: colors.text }]}>
                {formatMoney(order.totalTax)}
              </Text>
            </View>
          ) : null}
          <View style={styles.sumRow}>
            <Text style={[styles.sumTotal, { color: colors.text }]}>Total</Text>
            <Text style={[styles.sumTotal, { color: colors.text }]}>
              {formatMoney(order.totalPrice)}
            </Text>
          </View>
        </View>

        {canRequestCancel && (
          <>
            <PrimaryButton
              label="Request cancellation"
              onPress={requestCancellation}
            />
            <Text style={[styles.note, { color: colors.textMuted }]}>
              Sends us an email with your order number — we process the
              cancellation and your refund confirmation follows by email.
              Orders that have already shipped can&apos;t be cancelled.
            </Text>
          </>
        )}
        {cancelled && (
          <Text style={[styles.note, { color: "#E5484D" }]}>
            This order was cancelled.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  spinner: { marginTop: Spacing.xl },
  body: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xl },
  chipRow: { flexDirection: "row", gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "700" },
  placed: { fontSize: 13 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  thumb: { width: 52, height: 52, borderRadius: Radius.sm },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  itemMain: { flex: 1, gap: 1 },
  itemName: { fontSize: 15, fontWeight: "600" },
  itemVariant: { fontSize: 13 },
  itemPrice: { fontSize: 14, fontWeight: "700" },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  addrCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  addrLine: { fontSize: 14 },
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  sumTotal: { fontSize: 15, fontWeight: "800" },
  note: { textAlign: "center", fontSize: 13, marginTop: Spacing.sm },
});
