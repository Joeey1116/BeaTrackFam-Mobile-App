/** Auth gate — Log in / Create account / Shop as Guest. */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { LogoEye } from "../../components/LogoEye";
import { OutlineButton, PrimaryButton } from "../../components/ui";
import { useShop } from "../../store/shop";
import { Spacing } from "../../constants/theme";

export default function Welcome() {
  const { colors } = useTheme();
  const router = useRouter();
  const { continueAsGuest } = useShop();

  const onGuest = async () => {
    await continueAsGuest();
    // Always move forward into the app as a guest — never back into onboarding.
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.center}>
        <LogoEye size={96} />
        <Text style={[styles.title, { color: colors.text }]}>
          Welcome to{"\n"}BeaTrackFam
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Sign in to save your favorites, sync your profile, and get
          exclusive access to limited drops.
        </Text>
      </View>

      <View style={styles.ctaWrap}>
        <PrimaryButton
          label="Log In"
          onPress={() => router.push("/(onboarding)/login")}
        />
        <View style={styles.gap} />
        <OutlineButton
          label="Create Account"
          onPress={() => router.push("/(onboarding)/signup")}
        />
        <Pressable onPress={onGuest} hitSlop={12} style={styles.guestWrap}>
          <Text style={[styles.guest, { color: colors.textMuted }]}>
            Shop as Guest
          </Text>
        </Pressable>
        <Text style={[styles.guestNote, { color: colors.textDim }]}>
          Browsing as a guest: you can shop and check out, but saved
          addresses and your profile need an account.
        </Text>
      </View>

      <Text style={[styles.tagline, { color: colors.textDim }]}>
        Loyalty Above All
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  ctaWrap: { paddingHorizontal: Spacing.lg },
  gap: { height: Spacing.sm },
  guestWrap: { alignItems: "center", paddingTop: Spacing.md },
  guest: { fontSize: 15, fontWeight: "600" },
  guestNote: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  tagline: { textAlign: "center", fontSize: 12, paddingBottom: Spacing.md },
});
