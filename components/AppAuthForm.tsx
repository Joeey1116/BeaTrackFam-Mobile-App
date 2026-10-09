/**
 * BeaTrackFam app-account sign-in form (shared by login + signup).
 *
 * Accounts are registered with the BeaTrackFam accounts worker, so a
 * login survives deleting and reinstalling the app; the phone keeps a
 * local copy for its session and offline fallback (lib/accounts.ts).
 * After a successful sign-up the form shows an "Account created"
 * prompt, signs the fresh session back out, and lands on Log In a
 * couple of seconds later so the first log-in is a real one.
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "./ThemeProvider";
import { OutlineButton, PrimaryButton, ScreenHeader, TextField } from "./ui";
import { useShop } from "../store/shop";
import { Radius, Spacing, Type } from "../constants/theme";
import { isResetAvailable } from "../lib/passwordReset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AppAuthForm({ mode }: { mode: "login" | "signup" }) {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { signIn, signUp, signOut, continueAsGuest, signInWithShopify } =
    useShop();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [shopifyBusy, setShopifyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create Account" : "Log In";
  const heading = isSignup ? "Create account" : "Welcome back";

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
      if (result.ok && isSignup) {
        // Account created: say so, sign the fresh session back out, and
        // land on Log In a beat later so the first log-in is a real one.
        const address = email.trim();
        await signOut();
        setBusy(false);
        setCreated(true);
        setTimeout(() => {
          router.replace({
            pathname: "/(onboarding)/login",
            params: { email: address },
          });
        }, 2600);
      } else if (result.ok) {
        router.replace("/(tabs)");
      } else {
        setError(result.reason);
      }
    } finally {
      setBusy(false);
    }
  };

  const onShopify = async () => {
    setError(null);
    setShopifyBusy(true);
    try {
      const result = await signInWithShopify();
      if (result.ok) {
        router.replace("/(tabs)");
      } else {
        setError(result.reason);
      }
    } finally {
      setShopifyBusy(false);
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
        <Text style={[styles.title, Type.display, { color: colors.text }]}>
          {heading}
        </Text>
        <Text style={[styles.subtitle, Type.body, { color: colors.textMuted }]}>
          {isSignup
            ? "Create your BeaTrackFam account to save addresses, track orders and check out faster."
            : "Log in to your BeaTrackFam account."}{" "}
          Your account is registered with BeaTrackFam, so you can log
          back in on any phone — even after reinstalling the app.
        </Text>

        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.text + "0D",
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
          <View style={styles.bannerMain}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>
              We highly recommend using an account
            </Text>
            <Text style={[styles.bannerText, { color: colors.textMuted }]}>
              Check out faster, keep your addresses saved, and see every
              order with live tracking — all in one place.
            </Text>
          </View>
        </View>

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
          textContentType="emailAddress"
          autoComplete="email"
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
          textContentType={isSignup ? "newPassword" : "password"}
          autoComplete={isSignup ? "new-password" : "current-password"}
        />

        {isSignup && (
          <TextField
            label="Confirm Password"
            placeholder="Type it again"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            autoComplete="new-password"
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

        {created && (
          <View
            style={[styles.notice, { backgroundColor: colors.success + "1A" }]}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.success}
            />
            <Text style={[styles.noticeText, { color: colors.text }]}>
              Account created — welcome to the Fam. Taking you to log in…
            </Text>
          </View>
        )}

        <View style={styles.ctaWrap}>
          {busy || created ? (
            <View style={[styles.busy, { backgroundColor: colors.button }]}>
              <ActivityIndicator color={colors.buttonText} />
            </View>
          ) : (
            <PrimaryButton label="Continue" onPress={onContinue} />
          )}
        </View>

        {/* Guest entry sits directly under the primary CTA — visible
            without scrolling. Store reviewers (and shoppers) must
            never read this screen as a login wall; Google Play
            rejected v1206 for exactly that. */}
        <View style={styles.guestWrap}>
          <OutlineButton label="Shop as Guest" onPress={onGuest} />
        </View>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textDim }]}>
            or
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        {shopifyBusy ? (
          <View style={[styles.busy, { backgroundColor: colors.button }]}>
            <ActivityIndicator color={colors.buttonText} />
          </View>
        ) : (
          <OutlineButton
            label="Continue with Shopify"
            onPress={onShopify}
          />
        )}
        <Text style={[styles.shopifyNote, { color: colors.textDim }]}>
          Uses the email from your Shopify orders — no separate password
          to remember. Whether you continue with Shopify or use email
          above, it&apos;s the same BeaTrackFam account: your profile,
          addresses, and orders stay together by email.
        </Text>

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
          Sign up once — your login works on any phone. Delete the app and
          reinstall, and you can log right back in.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm },
  title: { marginBottom: Spacing.sm },
  subtitle: { marginBottom: Spacing.lg },
  notice: {
    flexDirection: "row",
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  ctaWrap: { marginBottom: Spacing.md, marginTop: Spacing.xs },
  busy: {
    borderRadius: Radius.pill,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  guestWrap: { marginTop: Spacing.md },
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
  banner: {
    flexDirection: "row",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  bannerMain: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 14, fontWeight: "800" },
  bannerText: { fontSize: 13, lineHeight: 18 },
  shopifyNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "600" },
});
