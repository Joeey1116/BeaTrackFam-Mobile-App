/** Order History — unlocked.
 *
 * Two sources, one list:
 *  - Orders placed in this app show up instantly (local receipts recorded at
 *    checkout, see lib/accounts.ts).
 *  - Every order on the customer's Shopify account (any channel) shows after
 *    they sign in with their email through Shopify's own secure page
 *    (Customer Account API, lib/customer.ts). We never see their password.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import {
  EmptyState,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SectionLabel,
} from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";
import { formatMoney, useShop } from "../../store/shop";
import type { OrderReceipt } from "../../lib/accounts";
import {
  getStoredSession,
  refreshSessionCustomer,
  startLogin,
  type CustomerOrder,
  type CustomerSession,
} from "../../lib/customer";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
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

export default function OrderHistory() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { orders: localOrders } = useShop();

  const [session, setSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await getStoredSession();
      setSession(stored);
      setLoading(false);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    const next = await refreshSessionCustomer(session);
    setSession(next);
    setRefreshing(false);
  }, [session]);

  const onSignIn = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    const result = await startLogin();
    setSigningIn(false);
    if (result.ok) {
      setSession(result.session);
    } else {
      setError(result.reason);
    }
  }, []);

  const shopifyOrders: CustomerOrder[] = session?.customer.orders ?? [];
  // A local receipt whose Shopify twin has arrived (same total, placed within
  // ~36h before the Shopify record) is shown once, from Shopify; the local
  // copy covers the gap until then.
  const freshLocal = localOrders.filter(
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

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Order History" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {freshLocal.length > 0 && (
          <>
            <SectionLabel text="JUST PLACED" />
            {freshLocal.map((o: OrderReceipt) => (
              <Pressable
                key={o.id}
                onPress={() =>
                  router.push({
                    pathname: "/settings/order/[id]",
                    params: { id: o.id },
                  })
                }
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardMain}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Order #{(o.id.split("/").pop() ?? o.id).slice(0, 10).toUpperCase()}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                    {formatDate(o.placedAt)} · {o.itemCount}{" "}
                    {o.itemCount === 1 ? "item" : "items"}
                  </Text>
                </View>
                <View style={styles.cardSide}>
                  <Text style={[styles.cardTotal, { color: colors.text }]}>
                    {formatMoney({
                      amount: o.totalAmount,
                      currencyCode: o.currencyCode,
                    })}
                  </Text>
                  <Text
                    style={[
                      styles.cardStatus,
                      {
                        color:
                          o.status === "cancelled"
                            ? "#E5484D"
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {o.status === "cancelled" ? "Cancelled" : "Processing"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textDim}
                />
              </Pressable>
            ))}
          </>
        )}

        <SectionLabel text="YOUR ORDERS" />
        {loading ? (
          <ActivityIndicator color={colors.text} style={styles.spinner} />
        ) : session ? (
          shopifyOrders.length > 0 ? (
            shopifyOrders.map((o) => (
              <Pressable
                key={o.id}
                onPress={() =>
                  router.push({
                    pathname: "/settings/order/shopify",
                    params: { id: o.id },
                  })
                }
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardMain}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Order {o.name}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                    {formatDate(o.processedAt)}
                  </Text>
                </View>
                <View style={styles.cardSide}>
                  <Text style={[styles.cardTotal, { color: colors.text }]}>
                    {formatMoney(o.totalPrice)}
                  </Text>
                  <Text style={[styles.cardStatus, { color: colors.textMuted }]}>
                    {fulfillLabel(o.fulfillmentStatus)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textDim}
                />
              </Pressable>
            ))
          ) : (
            <EmptyState
              icon={
                <Ionicons
                  name="receipt-outline"
                  size={44}
                  color={colors.textDim}
                />
              }
              title="No orders yet"
              subtitle="Orders tied to your email will appear here with live tracking as soon as they ship."
            />
          )
        ) : (
          <View
            style={[
              styles.signinCard,
              {
                backgroundColor: isDark ? "#141414" : "#F4F4F5",
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="mail-outline" size={34} color={colors.text} />
            <Text style={[styles.signinTitle, { color: colors.text }]}>
              See every order + tracking
            </Text>
            <Text style={[styles.signinSub, { color: colors.textMuted }]}>
              Enter your email on Shopify&apos;s secure sign-in page — Shopify sends
              you a one-time code, and your orders, statuses, and tracking
              numbers show up right here. We never see your password.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {signingIn ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <PrimaryButton
                label="Continue with email"
                onPress={onSignIn}
                icon={<Ionicons name="arrow-forward" size={17} color="#fff" />}
              />
            )}
            <OutlineButton
              label="How tracking works"
              onPress={() => router.push("/settings/faq")}
            />
          </View>
        )}

        <Text style={[styles.note, { color: colors.textMuted }]}>
          Every purchase also gets an order confirmation and tracking email
          from the shop. Loyalty Above All.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xl },
  spinner: { marginVertical: Spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSub: { fontSize: 13 },
  cardSide: { alignItems: "flex-end", gap: 2 },
  cardTotal: { fontSize: 15, fontWeight: "700" },
  cardStatus: { fontSize: 12, fontWeight: "600" },
  signinCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  signinTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  signinSub: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  error: { color: "#E5484D", fontSize: 13, textAlign: "center" },
  note: { textAlign: "center", fontSize: 13, marginTop: Spacing.md },
});
