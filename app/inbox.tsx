/**
 * Inbox — stub for Phase 2 of the 12.0.0 redesign.
 * Order updates, new-drop announcements and promo alerts land here;
 * the bell badge in the top bar turns on when real data arrives.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../components/ThemeProvider";
import { EmptyState, ScreenHeader } from "../components/ui";
import { Spacing } from "../constants/theme";

export default function Inbox() {
  const { colors } = useTheme();

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Inbox" align="center" showBack />
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: Spacing.lg },
});
