/**
 * Profile tab (12.0.0 redesign) — Klarna-style member home.
 *
 * Big initial avatar + name + Manage account, a black/white FAM MEMBER
 * card (member since, order count, Loyalty above all), grouped sections
 * (Your stuff / How you pay / Settings / Help / More), a big pill Sign
 * out using the existing store sign-out, and a version footer. Every
 * row routes to screens that already exist — nothing was removed.
 */
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useTheme, type ThemePreference } from "../../components/ThemeProvider";
import {
  MenuRow,
  OutlineButton,
  PrimaryButton,
  SectionLabel,
} from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { NativeDropdown } from "../../components/NativeDropdown";
import { useShop } from "../../store/shop";
import { useMergedOrderCount } from "../../lib/ordersCount";
import { Radius, Spacing, TabBarClearance, Type } from "../../constants/theme";

const STORE_LINKS =
  "Get the BeaTrackFam app — Loyalty Above All.\n" +
  "iOS: https://apps.apple.com/app/id6758099740\n" +
  "Android: https://play.google.com/store/apps/details?id=com.beatrackfaminc";

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: THEME_LABELS.light },
  { value: "dark", label: THEME_LABELS.dark },
  { value: "system", label: THEME_LABELS.system },
];

const APP_VERSION = Constants.expoConfig?.version ?? "";
const BUILD_NUMBER =
  Constants.nativeBuildVersion ??
  (Platform.OS === "ios"
    ? Constants.expoConfig?.ios?.buildNumber
    : String(Constants.expoConfig?.android?.versionCode ?? "")) ??
  "";

function memberSinceLabel(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function ProfileHero() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, profile } = useShop();

  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "Fam Member";
  const initial = (profile.firstName || account?.email || "F")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View style={styles.hero}>
      {profile.avatarUri ? (
        <Image source={{ uri: profile.avatarUri }} style={styles.heroAvatar} />
      ) : (
        <View
          style={[styles.heroAvatar, { backgroundColor: colors.text }]}
        >
          <Text
            style={[styles.heroInitial, { color: colors.background }]}
          >
            {initial}
          </Text>
        </View>
      )}
      <Text style={[styles.heroName, { color: colors.text }]}>{name}</Text>
      {account?.email ? (
        <Text style={[styles.heroEmail, { color: colors.textMuted }]}>
          {account.email}
        </Text>
      ) : null}
      <Pressable
        onPress={() => router.push("/profile")}
        hitSlop={8}
        style={styles.manageRow}
      >
        <Text style={[styles.manageText, { color: colors.text }]}>
          Manage account
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

function GuestHero() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.hero}>
      <View
        style={[styles.heroAvatar, { backgroundColor: colors.surface }]}
      >
        <Ionicons name="person" size={40} color={colors.textDim} />
      </View>
      <Text style={[styles.heroName, { color: colors.text }]}>
        Welcome to the Fam
      </Text>
      <Text style={[styles.heroEmail, { color: colors.textMuted }]}>
        Browsing as guest — log in to track orders, save addresses and
        manage your profile across devices.
      </Text>
      <View style={styles.guestCtas}>
        <View style={styles.guestCta}>
          <PrimaryButton
            label="Log In"
            onPress={() => router.push("/(onboarding)/login")}
          />
        </View>
        <View style={styles.guestCta}>
          <OutlineButton
            label="Sign Up"
            onPress={() => router.push("/(onboarding)/signup")}
          />
        </View>
      </View>
    </View>
  );
}

/** Inverse black/white member card — the eye, the motto, the receipts. */
function MemberCard({ orderCount }: { orderCount: number }) {
  const { colors } = useTheme();
  const { account, profile } = useShop();
  if (!account) return null;

  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "Fam Member";
  const since = memberSinceLabel(account.createdAt);
  const facts = [
    since ? `Member since ${since}` : null,
    `${orderCount} order${orderCount === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View style={[styles.memberCard, { backgroundColor: colors.button }]}>
      <Text style={[styles.memberEyebrow, { color: colors.buttonText }]}>
        FAM MEMBER
      </Text>
      <Text style={[styles.memberName, { color: colors.buttonText }]}>
        {name}
      </Text>
      {facts ? (
        <Text style={[styles.memberFacts, { color: colors.buttonText }]}>
          {facts}
        </Text>
      ) : null}
      <Text style={[styles.memberMotto, { color: colors.buttonText }]}>
        Loyalty above all
      </Text>
    </View>
  );
}

export default function SettingsHub() {
  const { colors, theme, setTheme } = useTheme();
  const router = useRouter();
  const { account, profile, signOut } = useShop();
  // Order count merged exactly as Order History shows it (Shopify
  // session orders incl. cancelled + linked + local receipts, deduped)
  // — refreshes on focus and on pull-to-refresh.
  const { count: orderCount, refresh: refreshOrderCount } =
    useMergedOrderCount();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshOrderCount();
    } finally {
      setRefreshing(false);
    }
  };

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

  const onSignOut = () => {
    Alert.alert("Sign out", "Sign out of your BeaTrackFam account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {account ? <ProfileHero /> : <GuestHero />}
        <MemberCard orderCount={orderCount} />

        <SectionLabel text="YOUR STUFF" />

        <MenuRow
          icon={icon("cube-outline")}
          title="Order History"
          subtitle="Track orders, view details & tracking"
          onPress={() => router.push("/settings/order-history")}
        />
        <MenuRow
          icon={icon("heart-outline")}
          title="Wishlist"
          subtitle="Your saved picks"
          onPress={() => router.push("/(tabs)/wishlist")}
        />
        <MenuRow
          icon={icon("location-outline")}
          title="Saved Addresses"
          subtitle={
            profile.addresses.length > 0
              ? `${profile.addresses.length} saved`
              : "Add your shipping addresses"
          }
          onPress={() => router.push("/profile/addresses")}
        />

        <SectionLabel text="HOW YOU PAY" />

        <MenuRow
          icon={icon("card-outline")}
          title="Payment Methods"
          subtitle="Cards you save at checkout are stored securely"
          onPress={() =>
            router.push(account ? "/profile" : "/(onboarding)/login")
          }
        />

        <SectionLabel text="SETTINGS" />

        <View
          style={[styles.dropdownCard, { backgroundColor: colors.surface }]}
        >
          <View style={styles.dropdownHead}>
            <View
              style={[
                styles.dropdownIcon,
                { backgroundColor: colors.surfaceRaised },
              ]}
            >
              {icon(
                theme === "dark"
                  ? "moon-outline"
                  : theme === "light"
                    ? "sunny-outline"
                    : "phone-portrait-outline"
              )}
            </View>
            <View style={styles.dropdownTextWrap}>
              <Text style={[styles.dropdownTitle, { color: colors.text }]}>
                Appearance
              </Text>
              <Text
                style={[styles.dropdownSubtitle, { color: colors.textMuted }]}
              >
                {THEME_LABELS[theme]}
              </Text>
            </View>
          </View>
          <NativeDropdown
            value={theme}
            options={THEME_OPTIONS}
            onSelect={(v) => setTheme(v as ThemePreference)}
            sheetTitle="Appearance"
            accessibilityLabel="Appearance"
          />
        </View>
        <MenuRow
          icon={icon("information-circle-outline")}
          title="App Settings"
          subtitle="Permissions, notifications, version and policies"
          onPress={() => router.push("/settings/app-settings")}
        />

        <SectionLabel text="HELP" />

        <MenuRow
          icon={icon("chatbubble-ellipses-outline")}
          title="Customer Service"
          subtitle="Get help — contact@beatrackfam.info"
          onPress={() => router.push("/settings/support")}
        />
        <MenuRow
          icon={icon("help-circle-outline")}
          title="FAQ"
          subtitle="Shipping, returns & more"
          onPress={() => router.push("/settings/faq")}
        />

        <SectionLabel text="MORE" />

        <MenuRow
          icon={icon("color-palette-outline")}
          title="Custom Design Request"
          subtitle="Get a one-of-a-kind piece made"
          onPress={() => router.push("/settings/design-request")}
        />
        <MenuRow
          icon={icon("cash-outline")}
          title="Earn With the Fam"
          subtitle="Share the brand — earn when your people shop"
          onPress={() => router.push("/settings/affiliates")}
        />
        <MenuRow
          icon={icon("share-social-outline")}
          title="Share App"
          subtitle="Tell your friends about BeaTrackFam"
          onPress={onShare}
        />
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

            <Pressable
              onPress={onSignOut}
              style={({ pressed }) => [
                styles.signOutPill,
                {
                  backgroundColor: colors.button,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[styles.signOutText, { color: colors.buttonText }]}
              >
                Sign out
              </Text>
            </Pressable>
          </>
        )}

        <Text style={[styles.versionFooter, { color: colors.textDim }]}>
          BeaTrackFam {APP_VERSION}
          {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ""}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: TabBarClearance },
  hero: { alignItems: "center", paddingVertical: Spacing.md, gap: 4 },
  heroAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  heroInitial: { fontSize: 34, fontWeight: "800" },
  heroName: { ...Type.headline, textAlign: "center" },
  heroEmail: {
    ...Type.caption,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: Spacing.xs,
    paddingVertical: 4,
  },
  manageText: { fontSize: 14, fontWeight: "700" },
  guestCtas: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
    marginTop: Spacing.md,
  },
  guestCta: { flex: 1 },
  memberCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: 3,
  },
  memberEyebrow: { ...Type.eyebrow, opacity: 0.75 },
  memberName: { fontSize: 20, fontWeight: "800" },
  memberFacts: { fontSize: 13, opacity: 0.85 },
  memberMotto: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginTop: Spacing.xs,
  },
  dropdownCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dropdownHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  dropdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownTextWrap: { flex: 1 },
  dropdownTitle: { fontSize: 16, fontWeight: "700" },
  dropdownSubtitle: { fontSize: 13, marginTop: 2 },
  signOutPill: {
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  signOutText: { fontSize: 16, fontWeight: "800" },
  versionFooter: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
