/** Linked Socials — instagram / tiktok / facebook / x handles. */
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { PrimaryButton, ScreenHeader, TextField } from "../../components/ui";
import { useShop } from "../../store/shop";
import type { SocialHandles } from "../../lib/customer";
import { Spacing } from "../../constants/theme";

const FIELDS: { key: keyof SocialHandles; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", placeholder: "@yourhandle" },
  { key: "tiktok", label: "TikTok", placeholder: "@yourhandle" },
  { key: "facebook", label: "Facebook", placeholder: "Your profile or page" },
  { key: "x", label: "X", placeholder: "@yourhandle" },
];

export default function Socials() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile, setSocial } = useShop();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Linked Socials" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          Link your socials so the fam can find you. Handles stay on your
          device — connecting real accounts comes later.
        </Text>
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            value={profile.socials[f.key]}
            onChangeText={(v) => setSocial(f.key, v)}
            autoCapitalize="none"
          />
        ))}
        <View style={styles.cta}>
          <PrimaryButton label="Done" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  cta: { marginTop: Spacing.sm },
});
