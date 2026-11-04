/** Order History — merged.
 *
 * Three sources, one list:
 *  - Orders placed in this app show up instantly (local receipts recorded at
 *    checkout, see lib/accounts.ts).
 *  - Every order on the signed-in BeaTrackFam site account
 *    (GET /api/account/orders) shows with live status + tracking on tap.
 *  - Guest orders found by order number + checkout email can be linked
 *    to the app account so they stay in history.
 * A local receipt whose site twin has arrived is shown once, from the
 * site; the local copy covers the gap until then. (Merge rule shared
 * with Profile + Inbox via lib/ordersCount.ts.)
 */
import React, { useCallback, useState } from "react";
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
import { useFocusEffect, useRouter } from "expo-router";
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
import {
  fetchSiteOrderList,
  formatCents,
  guestOrderLookup,
  siteOrderStatusLabel,
  type LinkedSiteOrder,
  type OrderReceipt,
  type SiteOrderDetail,
  type SiteOrderSummary,
} from "../../lib/accounts";
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

const digitsOf = (s: string) => s.replace(/\D/g, "");
function matchesNumber(number: string, input: string): boolean {
  const norm = input.trim().toUpperCase();
  if (!norm) return false;
  return (
    number.toUpperCase() === norm ||
    number.toUpperCase().endsWith(norm) ||
    (digitsOf(norm).length > 0 && digitsOf(number) === digitsOf(norm))
  );
}

export default function OrderHistory() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { orders: localOrders, account, linkSiteOrder, signOut } =
    useShop();

  const [siteOrders, setSiteOrders] = useState<SiteOrderSummary[] | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Find-an-order: order number + the email used at checkout. The site
  // only releases order data when number + email BOTH match, and a
  // found order can be bookmarked onto the app account.
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<SiteOrderDetail | null>(null);
  const [foundLinked, setFoundLinked] = useState<LinkedSiteOrder | null>(null);
  const [linking, setLinking] = useState(false);
  const [justLinked, setJustLinked] = useState(false);

  const loadSiteOrders = useCallback(async () => {
    if (!account) {
      setSiteOrders(null);
      setSiteLoading(false);
      return;
    }
    try {
      setSiteError(null);
      setSiteOrders(await fetchSiteOrderList());
    } catch (e) {
      setSiteError(e instanceof Error ? e.message : "Couldn't load orders.");
      setSiteOrders(null);
    } finally {
      setSiteLoading(false);
    }
  }, [account]);

  // useFocusEffect fires on focus, including the first mount — no
  // separate mount effect (lint: set-state-in-effect).
  useFocusEffect(
    useCallback(() => {
      void loadSiteOrders();
    }, [loadSiteOrders])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSiteOrders();
    setRefreshing(false);
  }, [loadSiteOrders]);

  const findOrder = useCallback(async () => {
    const number = lookupNumber.trim().toUpperCase();
    const emailNorm = lookupEmail.trim().toLowerCase();
    setLookupMsg(null);
    setFoundOrder(null);
    setFoundLinked(null);
    setJustLinked(false);
    if (!number) {
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
      const linked = (account?.linkedSiteOrders ?? []).find(
        (o) => matchesNumber(o.number, number) && o.email.toLowerCase() === emailNorm
      );
      if (linked) {
        setFoundLinked(linked);
        return;
      }
      // Signed-in list hit?
      const listed = (siteOrders ?? []).find((o) =>
        matchesNumber(o.number, number)
      );
      if (listed) {
        try {
          setFoundOrder(await guestOrderLookup(number, emailNorm));
        } catch {
          setLookupMsg(
            `No order ${number} found for ${emailNorm} — double-check the number from your confirmation email.`
          );
        }
        return;
      }
      try {
        setFoundOrder(await guestOrderLookup(number, emailNorm));
      } catch {
        setLookupMsg(
          `No order ${number} found for ${emailNorm} — double-check the number from your confirmation email.`
        );
      }
    } finally {
      setLookupBusy(false);
    }
  }, [lookupNumber, lookupEmail, account, siteOrders]);

  const foundAlreadyLinked = Boolean(
    (foundOrder &&
      (account?.linkedSiteOrders ?? []).some(
        (o) => o.number === foundOrder.number
      )) ||
      foundLinked ||
      justLinked
  );

  const onLinkFound = useCallback(async () => {
    if (!foundOrder || !account) return;
    setLinking(true);
    try {
      await linkSiteOrder({
        number: foundOrder.number,
        status: siteOrderStatusLabel(foundOrder.status),
        totalAmount: (foundOrder.totalCents / 100).toFixed(2),
        currencyCode: "USD",
        placedAt: foundOrder.createdAt,
        email: account.email.toLowerCase(),
      });
      setJustLinked(true);
    } finally {
      setLinking(false);
    }
  }, [foundOrder, account, linkSiteOrder]);

  const freshLocal = freshLocalReceipts(siteOrders ?? [], localOrders);

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
        {account ? (
          <View
            style={[
              styles.accountCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="person-circle-outline" size={22} color={colors.text} />
            <View style={styles.accountMain}>
              <Text style={[styles.accountEmail, { color: colors.text }]}>
                Signed in as {account.email}
              </Text>
              <Text style={[styles.accountNote, { color: colors.textDim }]}>
                These are the orders on your BeaTrackFam account.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Alert.alert("Sign out?", "You can sign back in anytime.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: async () => {
                      await signOut();
                      setSiteOrders(null);
                    },
                  },
                ]);
              }}
              hitSlop={8}
            >
              <Text style={[styles.signOut, { color: colors.text }]}>Sign out</Text>
            </Pressable>
          </View>
        ) : null}
        {siteLoading ? (
          <ActivityIndicator color={colors.text} style={styles.spinner} />
        ) : !account ? (
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
              Log in with your BeaTrackFam account and your orders,
              statuses, and tracking numbers show up right here.
            </Text>
            <PrimaryButton
              label="Log In"
              onPress={() => router.push("/(onboarding)/login")}
              icon={<Ionicons name="arrow-forward" size={17} color="#fff" />}
            />
            <OutlineButton
              label="How tracking works"
              onPress={() => router.push("/settings/faq")}
            />
          </View>
        ) : siteError ? (
          <Text style={[styles.lookupMsg, { color: colors.textMuted }]}>
            {siteError} Pull to refresh to try again — your in-app
            receipts and guest lookup below still work.
          </Text>
        ) : siteOrders === null ? (
          <Text style={[styles.lookupMsg, { color: colors.textMuted }]}>
            Store orders couldn&apos;t load right now — your in-app
            receipts and guest lookup below still work.
          </Text>
        ) : siteOrders.length > 0 ? (
          siteOrders.map((o) => (
            <Pressable
              key={o.number}
              onPress={() =>
                router.push({
                  pathname: "/settings/order/[id]",
                  params: { id: o.number },
                })
              }
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Order {o.number}
                </Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                  {formatDate(o.createdAt)} · {o.itemCount}{" "}
                  {o.itemCount === 1 ? "line" : "lines"}
                </Text>
              </View>
              <View style={styles.cardSide}>
                <Text style={[styles.cardTotal, { color: colors.text }]}>
                  {formatCents(o.totalCents)}
                </Text>
                <Text style={[styles.cardStatus, { color: colors.textMuted }]}>
                  {siteOrderStatusLabel(o.status)}
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
              placeholder="BTF-20261104-XXXX"
              value={lookupNumber}
              onChangeText={setLookupNumber}
              autoCapitalize="characters"
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
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/settings/order/[id]",
                  params: { id: foundOrder.number },
                })
              }
              style={[
                styles.card,
                styles.foundCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Order {foundOrder.number}
                </Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                  {formatDate(foundOrder.createdAt)}
                </Text>
              </View>
              <View style={styles.cardSide}>
                <Text style={[styles.cardTotal, { color: colors.text }]}>
                  {formatCents(foundOrder.totalCents)}
                </Text>
                <Text style={[styles.cardStatus, { color: colors.textMuted }]}>
                  {siteOrderStatusLabel(foundOrder.status)}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {foundLinked ? (
            <Text style={[styles.lookupMsg, { color: colors.textMuted }]}>
              Order {foundLinked.number} is already linked to your account
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

        {(account?.linkedSiteOrders ?? []).length > 0 && (
          <>
            <SectionLabel text="LINKED ORDERS" />
            {(account?.linkedSiteOrders ?? []).map((o) => {
              const live = (siteOrders ?? []).find(
                (s) => s.number === o.number
              );
              return (
                <Pressable
                  key={o.number}
                  onPress={() =>
                    router.push({
                      pathname: "/settings/order/[id]",
                      params: { id: o.number },
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
                      Order {live?.number ?? o.number}
                    </Text>
                    <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                      {formatDate(live?.createdAt ?? o.placedAt)} ·{" "}
                      {o.email}
                    </Text>
                  </View>
                  <View style={styles.cardSide}>
                    <Text style={[styles.cardTotal, { color: colors.text }]}>
                      {live
                        ? formatCents(live.totalCents)
                        : formatMoney({
                            amount: o.totalAmount,
                            currencyCode: o.currencyCode,
                          })}
                    </Text>
                    <Text
                      style={[styles.cardStatus, { color: colors.textMuted }]}
                    >
                      {live ? siteOrderStatusLabel(live.status) : o.status}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textDim}
                  />
                </Pressable>
              );
            })}
            <Text style={[styles.signinNote, { color: colors.textDim }]}>
              Sign in above to see live tracking on linked orders.
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
