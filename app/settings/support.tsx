/** Customer Service center (12.1.0 redesign, Phase 2).
 *
 * Klarna-style help hub in the brand's black & white: search the real
 * FAQ answers, "Help with an order" with live order status, help topics
 * that open the store's actual FAQ/policy content, and a pinned
 * "Ask anything" pill into Ask Bea. All content comes from data/faq.ts
 * and data/policies.ts — the same copy as the FAQ and Policies screens.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import {
  MenuRow,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SectionLabel,
} from "../../components/ui";
import { Radius, Spacing, Type } from "../../constants/theme";
import {
  FAQ_TOPICS,
  faqsForTopic,
  searchFaqs,
  type FaqEntry,
  type FaqTopicId,
} from "../../data/faq";
import { POLICIES } from "../../data/policies";
import { useShop } from "../../store/shop";
import {
  loadShopifySession,
  receiptStatusLabel,
  shopifyStatusLabel,
} from "../../lib/inbox";
import {
  HOURS_CONFIGURED,
  isOpenNow,
  nextOpeningLabel,
} from "../../lib/supportConfig";
import type { CustomerOrder } from "../../lib/customer";

const CONTACT_EMAIL = "contact@beatrackfam.info";

function mailUs() {
  Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() =>
    Alert.alert("Email", `Write to us at ${CONTACT_EMAIL}`)
  );
}

function FaqAccordion({ entry }: { entry: FaqEntry }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      style={[styles.faqCard, { backgroundColor: colors.surface }]}
    >
      <View style={styles.faqRow}>
        <Text style={[styles.faqQ, { color: colors.text }]}>{entry.q}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textDim}
        />
      </View>
      {open && (
        <Text style={[styles.faqA, { color: colors.textMuted }]}>
          {entry.a}
        </Text>
      )}
    </Pressable>
  );
}

interface OrderRow {
  key: string;
  title: string;
  sub: string;
  at: number;
  onPress?: () => void;
}

export default function CustomerService() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, orders: localOrders } = useShop();

  const [query, setQuery] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<FaqTopicId | null>(null);
  const [shopifyOrders, setShopifyOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadShopifySession({ refresh: true });
      if (cancelled) return;
      setShopifyOrders(session?.customer.orders ?? []);
      setOrdersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goOrders = useCallback(
    () => router.push("/settings/order-history"),
    [router]
  );

  const orderRows: OrderRow[] = [
    ...shopifyOrders.map<OrderRow>((o) => ({
      key: `sh-${o.id}`,
      title: `Order ${o.name}`,
      sub: shopifyStatusLabel(o),
      at: Date.parse(o.processedAt) || 0,
      onPress: () =>
        router.push({
          pathname: "/settings/order/shopify",
          params: { id: o.id },
        }),
    })),
    ...localOrders.map<OrderRow>((o) => ({
      key: `lo-${o.id}`,
      title: "Order placed in the app",
      sub: receiptStatusLabel(o),
      at: Date.parse(o.placedAt) || 0,
      onPress: () =>
        router.push({
          pathname: "/settings/order/[id]",
          params: { id: o.id },
        }),
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 3);

  const hasOrders = orderRows.length > 0;
  const searching = query.trim().length > 0;
  const results = searching ? searchFaqs(query) : [];

  // Live chat subtitle follows the posted business hours.
  const chatSubtitle = !HOURS_CONFIGURED
    ? "We read every chat in Shopify Inbox"
    : isOpenNow()
      ? "We're online now — say hi"
      : (() => {
          const back = nextOpeningLabel();
          return back
            ? `Offline — we're back ${back}`
            : "Leave a message — we reply when we're back";
        })();

  const icon = (name: string) => (
    <Ionicons
      name={name as React.ComponentProps<typeof Ionicons>["name"]}
      size={20}
      color={colors.text}
    />
  );

  const openTopic = (id: FaqTopicId) => {
    if (id === "contact") {
      mailUs();
      return;
    }
    setExpandedTopic((cur) => (cur === id ? null : id));
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Customer Service" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.searchPill, { backgroundColor: colors.input }]}>
          <Ionicons name="search-outline" size={18} color={colors.textDim} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search help — shipping, returns…"
            placeholderTextColor={colors.textDim}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {searching && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </Pressable>
          )}
        </View>

        {searching ? (
          <>
            <SectionLabel text="QUICK ANSWERS" />
            {results.length > 0 ? (
              results.map((f) => <FaqAccordion key={f.q} entry={f} />)
            ) : (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[Type.title, { color: colors.text }]}>
                  No quick answers matched
                </Text>
                <Text style={[styles.cardBody, { color: colors.textMuted }]}>
                  Try different words — or email the Fam at {CONTACT_EMAIL}{" "}
                  and we&apos;ll sort it out personally.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <SectionLabel text="HELP WITH AN ORDER" />
            {ordersLoading ? (
              <ActivityIndicator color={colors.text} style={styles.spinner} />
            ) : hasOrders ? (
              <>
                {orderRows.map((row) => (
                  <MenuRow
                    key={row.key}
                    icon={icon("receipt-outline")}
                    title={row.title}
                    subtitle={row.sub}
                    onPress={row.onPress ?? goOrders}
                  />
                ))}
                <OutlineButton
                  label="See all orders & tracking"
                  onPress={goOrders}
                />
              </>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[Type.title, { color: colors.text }]}>
                  {account ? "No orders to show yet" : "Find your order"}
                </Text>
                <Text style={[styles.cardBody, { color: colors.textMuted }]}>
                  {account
                    ? "When you place an order it'll appear here with live status. Checked out as a guest before? Look it up with your order number + email."
                    : "Continue with your email to see every order with live tracking, or look up a guest order with your order number + the email from checkout."}
                </Text>
                <PrimaryButton label="See my orders" onPress={goOrders} />
                <OutlineButton
                  label="Find a guest order"
                  onPress={goOrders}
                />
              </View>
            )}

            <SectionLabel text="TOPICS" />
            {FAQ_TOPICS.map((topic) => (
              <View key={topic.id}>
                <MenuRow
                  icon={icon(topic.icon)}
                  title={topic.title}
                  subtitle={topic.subtitle}
                  onPress={() => openTopic(topic.id)}
                />
                {expandedTopic === topic.id && topic.id !== "contact" && (
                  <View style={styles.topicBody}>
                    {faqsForTopic(topic.id).map((f) => (
                      <FaqAccordion key={f.q} entry={f} />
                    ))}
                    {topic.id === "products" && (
                      <MenuRow
                        icon={icon("color-palette-outline")}
                        title="Custom Design Request"
                        subtitle="Describe your idea — we reply by email"
                        onPress={() =>
                          router.push("/settings/design-request")
                        }
                      />
                    )}
                    {topic.policySlug && POLICIES[topic.policySlug] && (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/settings/policies/[slug]",
                            params: { slug: topic.policySlug as string },
                          })
                        }
                        style={styles.policyLink}
                      >
                        <Text style={[Type.link, { color: colors.text }]}>
                          Read the full {POLICIES[topic.policySlug].title}
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={15}
                          color={colors.textDim}
                        />
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            ))}

            <SectionLabel text="STILL NEED US?" />
            <MenuRow
              icon={icon("chatbubbles-outline")}
              title="Live chat"
              subtitle={chatSubtitle}
              onPress={() => router.push("/shop-chat")}
            />
            <MenuRow
              icon={icon("mail-outline")}
              title="Email Us"
              subtitle={CONTACT_EMAIL}
              onPress={mailUs}
            />
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.askBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push("/ask-bea")}
          style={({ pressed }) => [
            styles.askPill,
            { backgroundColor: colors.button, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="sparkles" size={17} color={colors.buttonText} />
          <Text style={[styles.askText, { color: colors.buttonText }]}>
            Ask anything
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  spinner: { marginVertical: Spacing.lg },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardBody: { fontSize: 14, lineHeight: 20 },
  faqCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  faqQ: { flex: 1, fontSize: 15, fontWeight: "700" },
  faqA: { fontSize: 14, lineHeight: 20, marginTop: Spacing.sm },
  topicBody: { marginBottom: Spacing.sm },
  policyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  askBar: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  askPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    paddingVertical: 15,
  },
  askText: { fontSize: 16, fontWeight: "800" },
});
