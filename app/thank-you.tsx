/** Thank You — shown after a successful checkout. The cart is already
 * cleared and the receipt recorded by the time the buyer lands here. */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../components/ThemeProvider";
import { PrimaryButton, OutlineButton, ScreenHeader } from "../components/ui";
import { formatMoney, useShop } from "../store/shop";
import { Spacing } from "../constants/theme";

function shortRef(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/^local-/, "").slice(0, 12);
}

export default function ThankYou() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, orders } = useShop();
  const latest = orders[0] ?? null;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Thank You" align="center" />
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
          <Ionicons name="checkmark-circle" size={72} color="#2E9E5B" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Thank you for your order!
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Your BeaTrackFam order is confirmed. A receipt was sent to{"\n"}
          <Text style={{ fontWeight: "700", color: colors.text }}>
            {latest?.email ?? account?.email ?? "your email"}
          </Text>
          .
        </Text>
        {latest && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                Order
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {shortRef(latest.id)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                Items
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {latest.itemCount}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                Total
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {formatMoney({
                  amount: latest.totalAmount,
                  currencyCode: latest.currencyCode,
                })}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.ctas}>
          <PrimaryButton
            label="View Order History"
            onPress={() => router.replace("/settings/order-history")}
          />
          <OutlineButton
            label="Continue Shopping"
            onPress={() => router.replace("/(tabs)")}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  card: {
    width: "100%",
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: { fontSize: 14 },
  metaValue: { fontSize: 14, fontWeight: "700" },
  ctas: { width: "100%", gap: Spacing.sm, marginTop: Spacing.sm },
});
