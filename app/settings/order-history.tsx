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
  Alert,
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
  TextField,
} from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";
import { formatMoney, useShop } from "../../store/shop";
import type {
  LinkedShopifyOrder,
  OrderReceipt,
} from "../../lib/accounts";
import {
  clearSession,
  getStoredSession,
  refreshSessionCustomer,
  startLogin,
  type CustomerOrder,
  type CustomerSession,
} from "../../lib/customer";
import { freshLocalReceipts } from "../../lib/ordersCount";

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
  const { orders: localOrders, account, linkShopifyOrder } = useShop();

  const [session, setSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find-an-order: order number + the email used on Shopify. Shopify
  // only releases order data to the owner of that email, so the lookup
  // either searches the already signed-in account (email must match)
  // or signs the user in with that email first (their own code from
  // Shopify). A found order can be bookmarked onto the app account.
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<CustomerOrder | null>(null);
  const [foundLinked, setFoundLinked] = useState<LinkedShopifyOrder | null>(
    null
  );
  const [linking, setLinking] = useState(false);
  const [justLinked, setJustLinked] = useState(false);

  const digitsOf = (s: string) => s.replace(/\D/g, "");
  const matchesNumber = (name: string, digits: string) =>
    digits.length > 0 && digitsOf(name) === digits;

  const findOrder = useCallback(async () => {
    const digits = digitsOf(lookupNumber);
    const emailNorm = lookupEmail.trim().toLowerCase();
    setLookupMsg(null);
    setFoundOrder(null);
    setFoundLinked(null);
    setJustLinked(false);
    if (!digits) {
      setLookupMsg("Enter the order number from your confirmation email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      setLookupMsg("Enter the email used for that order.");
      return;
    }
    setLookupBusy(true);
    try {
      // Already linked to the app account? Instant hit.
      const linked = (account?.linkedShopifyOrders ?? []).find((o) =>
        matchesNumber(o.name, digits)
      );
      if (linked && linked.email.toLowerCase() === emailNorm) {
        setFoundLinked(linked);
        return;
      }
      // Signed in with the same email? Search that account's orders.
      let sess = session;
      if (sess?.customer?.email?.toLowerCase() === emailNorm) {
        const hit = (sess.customer.orders ?? []).find((o) =>
          matchesNumber(o.name, digits)
        );
        if (hit) setFoundOrder(hit);
        else
          setLookupMsg(
            `No order #${digits} found for ${emailNorm} — double-check the number from your confirmation email.`
          );
        return;
      }
      if (sess) {
        setLookupMsg(
          `You're signed in as ${sess.customer.email ?? "another email"} — sign out above, then look up with ${emailNorm}.`
        );
        return;
      }
      // Not signed in: Shopify sign-in with this email (they type the
      // code Shopify sends — we never see it), then search.
      const result = await startLogin(emailNorm);
      if (!result.ok) {
        setLookupMsg(result.reason);
        return;
      }
      setSession(result.session);
      const hit = (result.session.customer.orders ?? []).find((o) =>
        matchesNumber(o.name, digits)
      );
      if (hit) setFoundOrder(hit);
      else
        setLookupMsg(
          `No order #${digits} found for ${emailNorm} — double-check the number from your confirmation email.`
        );
    } finally {
      setLookupBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupNumber, lookupEmail, session, account]);

  const foundAlreadyLinked = Boolean(
    (foundOrder &&
      (account?.linkedShopifyOrders ?? []).some(
        (o) => o.id === foundOrder.id
      )) ||
      foundLinked ||
      justLinked
  );

  const onLinkFound = useCallback(async () => {
    if (!foundOrder || !account) return;
    setLinking(true);
    try {
      await linkShopifyOrder({
        id: foundOrder.id,
        name: foundOrder.name,
        processedAt: foundOrder.processedAt,
        totalAmount: foundOrder.totalPrice.amount,
        currencyCode: foundOrder.totalPrice.currencyCode,
        status: foundOrder.cancelledAt
          ? "Cancelled"
          : fulfillLabel(foundOrder.fulfillmentStatus),
        email: (account.email ?? "").toLowerCase(),
      });
      setJustLinked(true);
    } finally {
      setLinking(false);
    }
  }, [foundOrder, account, linkShopifyOrder]);

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
  // A local receipt whose Shopify twin has arrived is shown once, from
  // Shopify; the local copy covers the gap until then. (Merge rule is
  // shared with Profile + Inbox via lib/ordersCount.ts.)
  const freshLocal = freshLocalReceipts(shopifyOrders, localOrders);

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
                    {o.status === "cancelled"
                            ? "Cancelled"
                            : o.status === "cancellation-requested"
                              ? "Cancel requested"
                              : "Processing"}
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
        {session?.customer ? (
          <View
            style={[
              styles.accountCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="person-circle-outline" size={22} color={colors.text} />
            <View style={styles.accountMain}>
              <Text style={[styles.accountEmail, { color: colors.text }]}>
                Signed in as {session.customer.email ?? "your Shopify account"}
              </Text>
              <Text style={[styles.accountNote, { color: colors.textDim }]}>
                Your BeaTrackFam app account is separate — these are the orders
                Shopify has for this email.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Alert.alert(
                  "Sign out?",
                  "Next time you tap Continue with email, Shopify will ask for an email — so you can sign in with a different one.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Sign out",
                      style: "destructive",
                      onPress: async () => {
                        await clearSession();
                        setSession(null);
                      },
                    },
                  ]
                );
              }}
              hitSlop={8}
            >
              <Text style={[styles.signOut, { color: colors.text }]}>Sign out</Text>
            </Pressable>
          </View>
        ) : null}
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
                    {o.cancelledAt
                      ? "Cancelled"
                      : fulfillLabel(o.fulfillmentStatus)}
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
            <Text style={[styles.signinNote, { color: colors.textDim }]}>
              Note: your BeaTrackFam app account is separate — Order History
              shows the orders Shopify has for the email you sign in with here.
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

        <SectionLabel text="FIND AN ORDER" />
        <View
          style={[
            styles.signinCard,
            {
              backgroundColor: isDark ? "#141414" : "#F4F4F5",
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={30} color={colors.text} />
          <Text style={[styles.signinTitle, { color: colors.text }]}>
            Ordered as a guest?
          </Text>
          <Text style={[styles.signinSub, { color: colors.textMuted }]}>
            Enter your order number and the email you used at checkout.
            If we find it, you can link it to your BeaTrackFam account so
            it stays in your history.
          </Text>
          <View style={styles.lookupForm}>
            <TextField
              label="Order number"
              placeholder="1010"
              value={lookupNumber}
              onChangeText={setLookupNumber}
              keyboardType="numbers-and-punctuation"
            />
            <TextField
              label="Email used for the order"
              placeholder="you@example.com"
              value={lookupEmail}
              onChangeText={setLookupEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          {lookupMsg ? (
            <Text style={styles.lookupMsg}>{lookupMsg}</Text>
          ) : null}
          {lookupBusy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <PrimaryButton label="Find my order" onPress={findOrder} />
          )}
          {foundOrder ? (
            <View
              style={[
                styles.card,
                styles.foundCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Order {foundOrder.name}
                </Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                  {formatDate(foundOrder.processedAt)}
                </Text>
              </View>
              <View style={styles.cardSide}>
                <Text style={[styles.cardTotal, { color: colors.text }]}>
                  {formatMoney(foundOrder.totalPrice)}
                </Text>
                <Text style={[styles.cardStatus, { color: colors.textMuted }]}>
                  {foundOrder.cancelledAt
                    ? "Cancelled"
                    : fulfillLabel(foundOrder.fulfillmentStatus)}
                </Text>
              </View>
            </View>
          ) : null}
          {foundLinked ? (
            <Text style={[styles.lookupMsg, { color: colors.textMuted }]}>
              Order {foundLinked.name} is already linked to your account
              below.
            </Text>
          ) : null}
          {foundOrder ? (
            foundAlreadyLinked ? (
              <Text style={[styles.lookupMsg, { color: colors.textMuted }]}>
                ✓ Linked to your BeaTrackFam account
              </Text>
            ) : !account ? (
              <Text style={[styles.lookupMsg, { color: colors.textMuted }]}>
                Log into the app (Profile → Log In) with this email to
                link the order to your account.
              </Text>
            ) : account.email.toLowerCase() !==
              lookupEmail.trim().toLowerCase() ? (
              <Text style={[styles.lookupMsg, { color: colors.textMuted }]}>
                This order is under {lookupEmail.trim().toLowerCase()} —
                log into the app with that email to link it.
              </Text>
            ) : linking ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <OutlineButton
                label="Link to my account"
                onPress={onLinkFound}
              />
            )
          ) : null}
        </View>

        {(account?.linkedShopifyOrders ?? []).length > 0 && (
          <>
            <SectionLabel text="LINKED ORDERS" />
            {(account?.linkedShopifyOrders ?? []).map((o) => {
              const live = shopifyOrders.find((s) => s.id === o.id);
              return (
                <Pressable
                  key={o.id}
                  disabled={!live}
                  onPress={() =>
                    live &&
                    router.push({
                      pathname: "/settings/order/shopify",
                      params: { id: o.id },
                    })
                  }
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.cardMain}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Order {live?.name ?? o.name}
                    </Text>
                    <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                      {formatDate(live?.processedAt ?? o.processedAt)} ·{" "}
                      {o.email}
                    </Text>
                  </View>
                  <View style={styles.cardSide}>
                    <Text style={[styles.cardTotal, { color: colors.text }]}>
                      {formatMoney(
                        live?.totalPrice ?? {
                          amount: o.totalAmount,
                          currencyCode: o.currencyCode,
                        }
                      )}
                    </Text>
                    <Text
                      style={[styles.cardStatus, { color: colors.textMuted }]}
                    >
                      {live
                        ? live.cancelledAt
                          ? "Cancelled"
                          : fulfillLabel(live.fulfillmentStatus)
                        : o.status}
                    </Text>
                  </View>
                  {live ? (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textDim}
                    />
                  ) : null}
                </Pressable>
              );
            })}
            <Text style={[styles.signinNote, { color: colors.textDim }]}>
              Sign in with the same email above to see live tracking on
              linked orders.
            </Text>
          </>
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
  signinNote: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  accountMain: { flex: 1, gap: 2 },
  accountEmail: { fontSize: 14, fontWeight: "700" },
  accountNote: { fontSize: 12, lineHeight: 16 },
  signOut: { fontSize: 13, fontWeight: "700" },
  error: { color: "#E5484D", fontSize: 13, textAlign: "center" },
  lookupForm: { alignSelf: "stretch", gap: Spacing.xs },
  lookupMsg: { fontSize: 13, lineHeight: 18, textAlign: "center", color: "#E5484D" },
  foundCard: { alignSelf: "stretch" },
  note: { textAlign: "center", fontSize: 13, marginTop: Spacing.md },
});
