/** Order History — currently locked behind a "Coming soon" placeholder
 * while checkout is being rebuilt. The route stays so deep links keep
 * working when the feature unlocks. */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import { EmptyState, ScreenHeader } from "../../components/ui";
import { Spacing } from "../../constants/theme";

export default function OrderHistory() {
  const { colors } = useTheme();
  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Order History" align="center" showBack />
      <View style={styles.body}>
        <EmptyState
          icon={
            <Ionicons name="receipt-outline" size={48} color={colors.textDim} />
          }
          title="Coming soon"
          subtitle="In-app order history is almost ready. Check back shortly — Loyalty Above All."
        />
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Every purchase still gets an order confirmation and tracking email
          from the shop.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: Spacing.lg },
  note: { textAlign: "center", fontSize: 13, marginTop: Spacing.md },
});
