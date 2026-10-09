/**
 * Ask Bea — stub for Phase 2 of the 12.0.0 redesign.
 * The assistant (live product search, order status/tracking, real
 * store policies) plugs in here; until then the quick chips route to
 * the real help screens so the button is never a dead end.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../components/ThemeProvider";
import { ScreenHeader } from "../components/ui";
import { LogoEye } from "../components/LogoEye";
import { Radius, Spacing, Type } from "../constants/theme";

const CHIPS: {
  label: string;
  route: "/settings/order-history" | "/settings/faq" | "/settings/support";
}[] = [
  { label: "Where's my order?", route: "/settings/order-history" },
  { label: "Shipping & returns", route: "/settings/faq" },
  { label: "Talk to the Fam", route: "/settings/support" },
];

export default function AskBea() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Ask Bea" align="center" showBack />
      <View style={styles.body}>
        <View
          style={[styles.beaBadge, { backgroundColor: colors.text }]}
        >
          <Ionicons name="sparkles" size={26} color={colors.background} />
        </View>
        <Text
          style={[Type.headline, styles.center, { color: colors.text }]}
        >
          Hey, I&apos;m Bea
        </Text>
        <Text
          style={[Type.body, styles.center, { color: colors.textMuted }]}
        >
          Soon I&apos;ll help you find products, check your orders and
          answer questions about the store — right here. For now, these
          take you straight to the answers:
        </Text>
        <View style={styles.chips}>
          {CHIPS.map((chip) => (
            <Pressable
              key={chip.label}
              onPress={() => router.push(chip.route)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>
                {chip.label}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={15}
                color={colors.textDim}
              />
            </Pressable>
          ))}
        </View>
        <View style={styles.footer}>
          <LogoEye size={22} />
          <Text style={[styles.footerText, { color: colors.textDim }]}>
            Loyalty above all
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  beaBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  center: { textAlign: "center" },
  chips: { width: "100%", gap: Spacing.sm, marginTop: Spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  chipText: { fontSize: 14, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.xl,
  },
  footerText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
});
