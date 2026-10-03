/** Order detail — full receipt view with line items and cancellation. */
import React, { useState } from "react";
import {
  Alert,
  Image,
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
import type { OrderReceipt } from "../../../lib/accounts";
import { Radius, Spacing } from "../../../constants/theme";

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
  const cancelled = status === "cancelled";
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: cancelled
            ? isDark
              ? "#3A2A2A"
              : "#FDECEA"
            : isDark
              ? "#1E3A2B"
              : "#E6F6EC",
        },
      ]}
    >
      <Text style={[styles.chipText, { color: cancelled ? "#E5484D" : "#2E9E5B" }]}>
        {cancelled ? "Cancelled" : "Completed"}
      </Text>
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

export default function OrderDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account, orders, cancelOrder } = useShop();
  const [cancelling, setCancelling] = useState(false);

  const order = orders.find((o) => o.id === id);
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
      "Cancel this order?",
      "This will mark the order as cancelled in the app. If it was already paid on Shopify, contact support@beatrackfam.info about a refund.",
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            await cancelOrder(order.id);
            setCancelling(false);
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
              label={cancelling ? "Cancelling…" : "Cancel Order"}
              onPress={onCancel}
            />
          </View>
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
