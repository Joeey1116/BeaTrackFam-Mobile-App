/**
 * Forgot password — 3 steps:
 *   1. Enter account email -> worker emails a 6-digit code (10 min expiry).
 *   2. Enter the code -> worker returns a single-use reset token.
 *   3. Choose a new password -> worker confirms the token, app updates
 *      the device-local password hash.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {
  isResetAvailable,
  requestResetCode,
  resetPasswordWithToken,
  verifyResetCode,
} from "../lib/passwordReset";

type Step = "email" | "code" | "password" | "done";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!isResetAvailable()) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Reset Password" align="center" showBack />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>
            Not available yet
          </Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Password reset is still being set up. Check back soon.
          </Text>
        </View>
      </View>
    );
  }

  const onSendCode = async () => {
    setError(null);
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const res = await requestResetCode(address);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setEmail(address);
    setStep("code");
    setCooldown(60);
  };

  const onVerifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    const res = await verifyResetCode(email, code.trim());
    setBusy(false);
    if (!res.ok || !res.resetToken) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setResetToken(res.resetToken);
    setStep("password");
  };

  const onSetPassword = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Choose a password with at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    if (!resetToken) {
      setError("Your session expired. Start over.");
      setStep("email");
      return;
    }
    setBusy(true);
    const res = await resetPasswordWithToken(email, resetToken, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setStep("done");
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
        {step === "email" && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              Forgot your password?
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Enter your account email and we&apos;ll send you a 6-digit code.
            </Text>
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </>
        )}

        {step === "code" && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              Check your email
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              We sent a 6-digit code to {email}. It expires in 10 minutes.
            </Text>
            <TextField
              label="Code"
              placeholder="123456"
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^\d]/g, "").slice(0, 6))}
              keyboardType="number-pad"
            />
            <Pressable
              disabled={cooldown > 0 || busy}
              onPress={onSendCode}
              hitSlop={10}
              style={styles.resend}
            >
              <Text
                style={[
                  styles.resendText,
                  {
                    color:
                      cooldown > 0 || busy ? colors.textDim : colors.text,
                  },
                ]}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Text>
            </Pressable>
          </>
        )}

        {step === "password" && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              Choose a new password
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Make it at least 6 characters.
            </Text>
            <TextField
              label="New Password"
              placeholder="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextField
              label="Confirm Password"
              placeholder="Type it again"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
            />
          </>
        )}

        {step === "done" && (
          <View style={styles.doneWrap}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={colors.success ?? "#2E9E5B"}
            />
            <Text style={[styles.title, { color: colors.text }]}>
              Password updated
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              You can log in with your new password now.
            </Text>
            <PrimaryButton
              label="Back to Log In"
              onPress={() => router.replace("/(onboarding)/login")}
            />
          </View>
        )}

        {error && step !== "done" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger + "14" }]}
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

        {step !== "done" && (
          <View style={styles.cta}>
            {busy ? (
              <View style={[styles.busy, { backgroundColor: colors.button }]}>
                <ActivityIndicator color={colors.buttonText} />
              </View>
            ) : (
              <PrimaryButton
                label={
                  step === "email"
                    ? "Send Code"
                    : step === "code"
                      ? "Verify Code"
                      : "Set New Password"
                }
                onPress={
                  step === "email"
                    ? onSendCode
                    : step === "code"
                      ? onVerifyCode
                      : onSetPassword
                }
              />
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: Spacing.md },
  resend: { alignSelf: "flex-start", marginTop: 4 },
  resendText: { fontSize: 14, fontWeight: "700" },
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
