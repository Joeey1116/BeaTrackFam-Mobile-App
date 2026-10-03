/**
 * Shared layout for the onboarding permission / preference screens:
 * icon, title, body, optional bullets, primary + secondary actions.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { PrimaryButton } from "./ui";
import { Spacing } from "../constants/theme";

interface Bullet {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}

interface PermissionScreenProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
  bullets?: Bullet[];
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  note?: string;
  children?: React.ReactNode;
}

export function PermissionScreen({
  icon,
  title,
  body,
  bullets,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  note,
  children,
}: PermissionScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <View
          style={[styles.iconCircle, { backgroundColor: colors.accent + "22" }]}
        >
          <Ionicons name={icon} size={52} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>

        {bullets && (
          <View style={styles.bullets}>
            {bullets.map((b) => (
              <View key={b.text} style={styles.bulletRow}>
                <Ionicons name={b.icon} size={20} color={colors.accent} />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {b.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {children}
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={primaryLabel} onPress={onPrimary} disabled={primaryDisabled} />
        {secondaryLabel && onSecondary && (
          <Pressable onPress={onSecondary} hitSlop={12} style={styles.secondaryWrap}>
            <Text style={[styles.secondary, { color: colors.textMuted }]}>
              {secondaryLabel}
            </Text>
          </Pressable>
        )}
        {note && (
          <Text style={[styles.note, { color: colors.textDim }]}>{note}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  bullets: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
    alignSelf: "stretch",
  },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  bulletText: { fontSize: 14, fontWeight: "600", flex: 1 },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  secondaryWrap: { alignItems: "center", paddingVertical: Spacing.md },
  secondary: { fontSize: 15, fontWeight: "600" },
  note: { fontSize: 12, textAlign: "center", lineHeight: 17 },
});
