/**
 * Forgot password — site email-link flow.
 *
 * Enter your account email and the site emails you a reset link.
 * The link opens the SITE in the browser (the site's reset page at
 * /account/?token=… — it is a web page, not an app deep link, so no
 * in-app reset form is wired): reset there, then log in here with
 * the new password. The response is always the same generic message,
 * whether or not the email has an account.
 *
 * This replaces the old 6-digit-code worker flow (deleted Nov 2026
 * with lib/passwordReset.ts): there is no code to type and no
 * in-app password form anymore.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../components/ThemeProvider";
import {
  PrimaryButton,
  ScreenHeader,
  TextField,
} from "../components/ui";
import { Spacing } from "../constants/theme";
import { requestForgotPassword } from "../lib/accounts";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSendLink = async () => {
    setError(null);
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const res = await requestForgotPassword(address);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.safe, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Reset Password" align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {sent ? (
          <View style={styles.doneWrap}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={colors.success ?? "#2E9E5B"}
            />
            <Text style={[styles.title, { color: colors.text }]}>
              Check your email
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              If an account exists for {email}, you&apos;ll receive a
              password reset link. Open it in your browser to choose a
              new password, then come back here and log in with it.
            </Text>
            <PrimaryButton
              label="Back to Log In"
              onPress={() => router.replace("/(onboarding)/login")}
            />
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              Forgot your password?
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Enter your account email and we&apos;ll send you a link to
              reset it. The link opens our website, where you choose a
              new password — then log in here with it.
            </Text>
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {error && (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: colors.danger + "14" },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.danger}
                />
                <Text style={[styles.noticeText, { color: colors.danger }]}>
                  {error}
                </Text>
              </View>
            )}
            <View style={styles.cta}>
              {busy ? (
                <View style={[styles.busy, { backgroundColor: colors.button }]}>
                  <ActivityIndicator color={colors.buttonText} />
                </View>
              ) : (
                <PrimaryButton
                  label="Send Reset Link"
                  onPress={onSendLink}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: Spacing.md, lineHeight: 20 },
  cta: { marginTop: Spacing.md },
  busy: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: Spacing.sm,
  },
  noticeText: { fontSize: 13, flex: 1 },
  doneWrap: { alignItems: "center", gap: 8, paddingTop: Spacing.xl },
});
