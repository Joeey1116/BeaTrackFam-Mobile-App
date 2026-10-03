/**
 * BeaTrackFam app-account sign-in form (shared by login + signup).
 *
 * Email + password, stored as a salted hash ON THIS DEVICE ONLY
 * (lib/accounts.ts) — sign-in never touches Shopify, so it can't break
 * when Shopify's APIs hiccup. The UI says plainly that accounts live on
 * this device.
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
import { useTheme } from "./ThemeProvider";
import { OutlineButton, PrimaryButton, ScreenHeader, TextField } from "./ui";
import { useShop } from "../store/shop";
import { Spacing } from "../constants/theme";
import { isResetAvailable } from "../lib/passwordReset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AppAuthForm({ mode }: { mode: "login" | "signup" }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { signIn, signUp, continueAsGuest } = useShop();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create Account" : "Log In";
  const heading = isSignup ? "Join the Fam" : "Welcome Back";

  const onContinue = async () => {
    setError(null);
    if (isSignup && name.trim().length < 2) {
      setError("Enter your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Your password needs at least 6 characters.");
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const result = isSignup
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);
      if (result.ok) {
        router.replace("/(tabs)");
      } else {
        setError(result.reason);
      }
    } finally {
      setBusy(false);
    }
  };

  const onGuest = async () => {
    await continueAsGuest();
    // Go back to wherever the shopper came from instead of pushing forward.
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title={title} align="center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>{heading}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {isSignup
            ? "Create your BeaTrackFam account to save addresses, track orders and check out faster."
            : "Log in to your BeaTrackFam account."}{" "}
          Your account lives on this device — your password never leaves
          your phone.
        </Text>

        {isSignup && (
          <TextField
            label="Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextField
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextField
          label="Password"
          placeholder={
            isSignup ? "Choose a password (6+ characters)" : "Your password"
          }
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {isSignup && (
          <TextField
            label="Confirm Password"
            placeholder="Type it again"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        )}

        {!isSignup && isResetAvailable() && (
          <Pressable
            onPress={() => router.push("/forgot-password")}
            hitSlop={10}
            style={styles.forgotWrap}
          >
            <Text style={[styles.forgotText, { color: colors.text }]}>
              Forgot password?
            </Text>
          </Pressable>
        )}

        {error && (
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

        <View style={styles.ctaWrap}>
          {busy ? (
            <View style={[styles.busy, { backgroundColor: colors.button }]}>
              <ActivityIndicator color={colors.buttonText} />
            </View>
          ) : (
            <PrimaryButton
              label={isSignup ? "Create Account" : "Log In"}
              onPress={onContinue}
            />
          )}
        </View>

        <OutlineButton label="Shop as Guest" onPress={onGuest} />

        <View style={styles.switchWrap}>
          <Text style={[styles.switchText, { color: colors.textMuted }]}>
            {isSignup ? "Already have an account?" : "Don't have an account?"}
          </Text>
          <Pressable
            onPress={() =>
              router.replace(
                isSignup ? "/(onboarding)/login" : "/(onboarding)/signup"
              )
            }
            hitSlop={10}
          >
            <Text style={[styles.switchLink, { color: colors.text }]}>
              {isSignup ? "Log In" : "Sign Up"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.deviceNote, { color: colors.textDim }]}>
          Accounts are stored on this device only — they don&apos;t follow
          you to another phone.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  notice: {
    flexDirection: "row",
    gap: Spacing.sm,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  ctaWrap: { marginBottom: Spacing.md, marginTop: Spacing.xs },
  busy: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  switchWrap: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  switchText: { fontSize: 14 },
  switchLink: { fontSize: 14, fontWeight: "700" },
  forgotWrap: { alignSelf: "flex-end", marginTop: 2 },
  forgotText: { fontSize: 14, fontWeight: "700" },
  deviceNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
