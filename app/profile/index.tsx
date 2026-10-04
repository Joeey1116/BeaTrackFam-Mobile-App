/** Profile — avatar, details, addresses, interests, socials, logout. */
import React, { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../components/ThemeProvider";
import {
  EmptyState,
  MenuRow,
  OutlineButton,
  ScreenHeader,
  SectionLabel,
} from "../../components/ui";
import { useShop } from "../../store/shop";
import { Radius, Spacing } from "../../constants/theme";

function AvatarPicker() {
  const { colors } = useTheme();
  const { profile, setAvatar } = useShop();
  const [picking, setPicking] = useState(false);

  const onPick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo access to set a profile picture."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        await setAvatar(result.assets[0].uri);
      }
    } finally {
      setPicking(false);
    }
  };

  return (
    <Pressable
      onPress={onPick}
      style={({ pressed }) => [
        styles.avatarWrap,
        { opacity: pressed ? 0.8 : 1 },
      ]}
      accessibilityLabel="Change profile photo"
    >
      {profile.avatarUri ? (
        <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
      ) : (
        <View
          style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons name="person" size={40} color={colors.textDim} />
        </View>
      )}
      <View style={[styles.avatarEdit, { backgroundColor: colors.text }]}>
        <Ionicons name="camera" size={14} color={colors.background} />
      </View>
    </Pressable>
  );
}

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, profile, signOut } = useShop();

  const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) => (
    <Ionicons name={name} size={20} color={colors.text} />
  );

  const onLogout = () => {
    Alert.alert("Log Out", "Sign out of your BeaTrackFam account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        onPress: async () => {
          await signOut();
          // Back to where he came from (Settings), not forward to Home.
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)/settings");
          }
        },
      },
    ]);
  };

  if (!account) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Profile" align="center" showBack />
        <View style={styles.gate}>
          <EmptyState
            icon={
              <Ionicons
                name="person-circle-outline"
                size={48}
                color={colors.textDim}
              />
            }
            title="Log in to see your profile"
            subtitle="Your profile, addresses and interests live with your account."
          />
          <View style={styles.gateCtas}>
            <OutlineButton
              label="Log In / Sign Up"
              onPress={() => router.push("/(onboarding)/login")}
            />
          </View>
        </View>
      </View>
    );
  }

  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "Fam Member";

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Profile" align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AvatarPicker />
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          {account.email ? (
            <Text style={[styles.email, { color: colors.textMuted }]}>
              {account.email}
            </Text>
          ) : null}
        </View>

        <MenuRow
          icon={icon("create-outline")}
          title="Edit Profile"
          subtitle="Name, phone and photo"
          onPress={() => router.push("/profile/edit")}
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
        <MenuRow
          icon={icon("heart-outline")}
          title="Interests"
          subtitle={
            profile.interests.length > 0
              ? profile.interests.slice(0, 3).join(", ")
              : "Pick what you're into"
          }
          onPress={() => router.push("/profile/interests")}
        />
        <MenuRow
          icon={icon("at-outline")}
          title="Linked Socials"
          subtitle="Instagram, TikTok, Facebook, X"
          onPress={() => router.push("/profile/socials")}
        />

        <SectionLabel text="PAYMENT" />

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardRow}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Ionicons
                name="card-outline"
                size={22}
                color={colors.text}
              />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Payment Methods
              </Text>
              <Text style={[styles.cardBody, { color: colors.textMuted }]}>
                Cards you save at checkout are stored securely by Shopify. We
                never see or store your card numbers.
              </Text>
            </View>
          </View>
        </View>

        <SectionLabel text="ACCOUNT" />

        <MenuRow
          icon={icon("log-out-outline")}
          title="Log Out"
          subtitle="Sign out of this device"
          onPress={onLogout}
        />
        <Pressable onPress={() => router.push("/settings/delete-account")} hitSlop={8}>
          <Text style={[styles.delete, { color: colors.danger }]}>
            Delete my account
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  gate: { flex: 1, justifyContent: "center", padding: Spacing.lg },
  gateCtas: { marginTop: Spacing.md },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  hero: { alignItems: "center", marginVertical: Spacing.lg },
  avatarWrap: { marginBottom: Spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEdit: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 22, fontWeight: "800" },
  email: { fontSize: 14, marginTop: 4 },
  card: { borderRadius: Radius.lg, padding: Spacing.md },
  cardRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  delete: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
