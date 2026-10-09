/**
 * Inbox (12.1.0 redesign, Phase 2) — real updates from live store data.
 *
 * Items are derived on device (lib/inbox.ts): your orders with live
 * status, the newest drops, and a welcome note, grouped by recency.
 * Opening the Inbox marks everything seen, which clears the TopBar
 * bell badge everywhere.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useTheme } from "../components/ThemeProvider";
import { EmptyState, ScreenHeader, SectionLabel } from "../components/ui";
import { LogoEye } from "../components/LogoEye";
import { Radius, Spacing, Type } from "../constants/theme";
import {
  groupInboxItems,
  timeAgo,
  useInbox,
  type InboxItem,
} from "../lib/inbox";
import { useShop } from "../store/shop";

function ItemIcon({ item }: { item: InboxItem }) {
  const { colors } = useTheme();
  if (item.kind === "welcome") {
    return <LogoEye size={40} />;
  }
  return (
    <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
      <Ionicons
        name={item.kind === "order" ? "receipt-outline" : "shirt-outline"}
        size={20}
        color={colors.text}
      />
    </View>
  );
}

export default function Inbox() {
  const { colors } = useTheme();
  const router = useRouter();
  const { refreshCatalog } = useShop();
  const { items, lastSeen, loading, markAllSeen, refresh } = useInbox();
  const [refreshing, setRefreshing] = useState(false);
  // The last-seen value as it was when the screen opened, so this visit
  // still groups what was new under "New" after the badge clears.
  const [seenAtOpen, setSeenAtOpen] = useState<number | null>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (loading || lastSeen === null || markedRef.current) return;
    markedRef.current = true;
    setSeenAtOpen(lastSeen);
    void markAllSeen();
  }, [loading, lastSeen, markAllSeen]);

  const groups = useMemo(
    () => groupInboxItems(items, seenAtOpen),
    [items, seenAtOpen]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    refreshCatalog();
    await refresh();
    setRefreshing(false);
  };

  const openItem = (item: InboxItem) => {
    if (item.orderId && item.orderSource === "shopify") {
      router.push({
        pathname: "/settings/order/shopify",
        params: { id: item.orderId },
      });
    } else if (item.orderId && item.orderSource === "local") {
      router.push({
        pathname: "/settings/order/[id]",
        params: { id: item.orderId },
      });
    } else if (item.productNumericId) {
      router.push({
        pathname: "/product/[id]",
        params: { id: item.productNumericId },
      });
    } else if (item.kind === "welcome") {
      router.push("/(tabs)/collections");
    } else if (item.kind === "order") {
      // Linked order without its live record loaded — Order History is
      // where it opens with full detail.
      router.push("/settings/order-history");
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Inbox" align="center" showBack />
      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.text} style={styles.spinner} />
      ) : items.length === 0 ? (
        <View style={styles.body}>
          <EmptyState
            icon={
              <Ionicons
                name="mail-open-outline"
                size={52}
                color={colors.textDim}
              />
            }
            title="You're all caught up"
            subtitle="Order updates, new drops and Fam-only offers will show up here. Nothing to catch up on yet."
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {groups.map((group) => (
            <View key={group.label}>
              <SectionLabel text={group.label.toUpperCase()} />
              {group.items.map((item) => {
                const unread =
                  seenAtOpen !== null && item.at > seenAtOpen;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openItem(item)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: colors.surface,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <ItemIcon item={item} />
                    <View style={styles.rowText}>
                      <Text
                        style={[Type.title, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[Type.caption, { color: colors.textMuted }]}
                        numberOfLines={2}
                      >
                        {item.body}
                      </Text>
                      <Text
                        style={[styles.time, { color: colors.textDim }]}
                      >
                        {timeAgo(item.at)}
                      </Text>
                    </View>
                    {unread && (
                      <View
                        style={[
                          styles.unreadDot,
                          { backgroundColor: colors.danger },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Text style={[styles.footer, { color: colors.textDim }]}>
            Loyalty above all
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: Spacing.lg },
  spinner: { marginTop: Spacing.xl },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  time: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  footer: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
