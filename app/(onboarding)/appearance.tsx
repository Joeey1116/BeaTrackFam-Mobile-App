/** Onboarding: appearance — pick Light, Dark, or System. */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, type ThemePreference } from "../../components/ThemeProvider";
import { PrimaryButton } from "../../components/ui";
import { Radius, Spacing } from "../../constants/theme";

const CHOICES: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { value: "light", label: "Light", hint: "Classic bright look", icon: "sunny-outline" },
  { value: "dark", label: "Dark", hint: "Easy on the eyes", icon: "moon-outline" },
  { value: "system", label: "System", hint: "Match your device", icon: "phone-portrait-outline" },
];

export default function Appearance() {
  const { colors, theme, setTheme } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accent + "22" }]}>
          <Ionicons name="contrast-outline" size={52} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Choose Your Look
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Pick how BeaTrackFam looks on your phone. You can change this anytime
          in Settings.
        </Text>

        <View style={styles.choices}>
          {CHOICES.map((c) => {
            const selected = theme === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setTheme(c.value)}
                style={[
                  styles.choice,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.choiceIcon,
                    { backgroundColor: colors.surfaceRaised },
                  ]}
                >
                  <Ionicons
                    name={c.icon}
                    size={24}
                    color={selected ? colors.accent : colors.text}
                  />
                </View>
                <View style={styles.choiceText}>
                  <Text style={[styles.choiceLabel, { color: colors.text }]}>
                    {c.label}
                  </Text>
                  <Text style={[styles.choiceHint, { color: colors.textMuted }]}>
                    {c.hint}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={selected ? colors.accent : colors.textDim}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue"
          onPress={() => router.push("/(onboarding)/notifications")}
        />
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
  choices: { marginTop: Spacing.lg, gap: Spacing.sm, alignSelf: "stretch" },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceText: { flex: 1 },
  choiceLabel: { fontSize: 16, fontWeight: "800" },
  choiceHint: { fontSize: 13, marginTop: 2 },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
});
