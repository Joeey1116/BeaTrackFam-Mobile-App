/** Settings tab — profile card + menu hub with separate screens. */
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, type ThemePreference } from "../../components/ThemeProvider";
import { MenuRow, ScreenHeader, SectionLabel } from "../../components/ui";
import { useShop } from "../../store/shop";
import { Radius, Spacing } from "../../constants/theme";

const STORE_LINKS =
  "Get the BeaTrackFam app — Loyalty Above All.\n" +
  "iOS: https://apps.apple.com/app/id6758099740\n" +
  "Android: https://play.google.com/store/apps/details?id=com.beatrackfaminc";

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};
const THEME_ORDER: ThemePreference[] = ["light", "dark", "system"];

function ProfileCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, profile } = useShop();

  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "Fam Member";
  const email = account?.email ?? "";

  return (
    <Pressable
      onPress={() => router.push("/profile")}
      style={({ pressed }) => [
        styles.profileCard,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {profile.avatarUri ? (
        <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
      ) : (
        <View
          style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons name="person" size={28} color={colors.textDim} />
        </View>
      )}
      <View style={styles.profileText}>
        <Text style={[styles.profileName, { color: colors.text }]}>{name}</Text>
        {email ? (
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
            {email}
          </Text>
        ) : (
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
            View and edit your profile
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
    </Pressable>
  );
}

function GuestCard() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(onboarding)/login")}
      style={({ pressed }) => [
        styles.profileCard,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
        <Ionicons name="person" size={28} color={colors.textDim} />
      </View>
      <View style={styles.profileText}>
        <Text style={[styles.profileName, { color: colors.text }]}>
          Log in / Create account
        </Text>
        <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
          Browsing as guest — saved addresses and your profile need an
          account
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
    </Pressable>
  );
}

export default function SettingsHub() {
  const { colors, theme, setTheme } = useTheme();
  const router = useRouter();
  const { account } = useShop();

  const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) => (
    <Ionicons name={name} size={20} color={colors.text} />
  );

  const onShare = async () => {
    try {
      await Share.share({ message: STORE_LINKS });
    } catch {
      // user dismissed — nothing to do
    }
  };

  const cycleTheme = () => {
    setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]);
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        {account ? <ProfileCard /> : <GuestCard />}

        <MenuRow
          icon={icon("color-palette-outline")}
          title="Custom Design Request"
          subtitle="Get a one-of-a-kind piece made"
          onPress={() => router.push("/settings/design-request")}
        />
        <MenuRow
          icon={icon("share-social-outline")}
          title="Share App"
          subtitle="Tell your friends about BeaTrackFam"
          onPress={onShare}
        />
        <MenuRow
          icon={icon("chatbubble-ellipses-outline")}
          title="Support"
          subtitle="Get help — contact@beatrackfam.info"
          onPress={() => router.push("/settings/support")}
        />
        <MenuRow
          icon={icon("cube-outline")}
          title="Order History"
          subtitle="Coming soon"
          onPress={() => router.push("/settings/order-history")}
        />

        <SectionLabel text="APP" />

        <MenuRow
          icon={icon(
            theme === "dark"
              ? "moon-outline"
              : theme === "light"
                ? "sunny-outline"
                : "phone-portrait-outline"
          )}
          title="Appearance"
          subtitle={THEME_LABELS[theme]}
          onPress={cycleTheme}
        />
        <MenuRow
          icon={icon("information-circle-outline")}
          title="App Settings"
          subtitle="Permissions, version and policies"
          onPress={() => router.push("/settings/app-settings")}
        />

        <SectionLabel text="ABOUT" />

        <MenuRow
          icon={icon("eye-outline")}
          title="About BeaTrackFam"
          subtitle="Our story — Loyalty Above All"
          onPress={() => router.push("/settings/about")}
        />

        {account && (
          <>
            <SectionLabel text="DANGER ZONE" />
            <MenuRow
              icon={
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.danger}
                />
              }
              title="Delete Account"
              subtitle="Request deletion of your account"
              onPress={() => router.push("/settings/delete-account")}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: "800" },
  profileEmail: { fontSize: 13, marginTop: 2 },
});
