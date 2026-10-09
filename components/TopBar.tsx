/**
 * TopBar — the 12.0.0 redesign's main-screen header.
 *
 * Layout (Klarna/top-shopping-app structure, BeaTrackFam black & white):
 * circular avatar w/ initial → wide pill search → bell (Inbox) + Ask Bea
 * sparkle + cart. Used on the four tab screens. The bell badge is live
 * since Phase 2: it counts Inbox items newer than the last-seen
 * timestamp (lib/inbox.ts) and hides at zero.
 */
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "./ThemeProvider";
import { CartButton } from "./CartButton";
import { LogoEye } from "./LogoEye";
import { useShop } from "../store/shop";
import { useInbox } from "../lib/inbox";
import { Radius, Spacing } from "../constants/theme";

function AvatarButton() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, profile } = useShop();

  const name = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const initial = (name || account?.email || "")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/settings")}
      hitSlop={8}
      accessibilityLabel="Open profile"
      style={({ pressed }) => [
        styles.avatarBtn,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {profile.avatarUri ? (
        <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
      ) : initial ? (
        <View
          style={[styles.avatar, { backgroundColor: colors.text }]}
        >
          <Text
            style={[styles.avatarInitial, { color: colors.background }]}
          >
            {initial}
          </Text>
        </View>
      ) : (
        <LogoEye size={40} />
      )}
    </Pressable>
  );
}

export function TopBar({ hideSearch = false }: { hideSearch?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { unreadCount } = useInbox();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.header }]}
    >
      <View style={styles.row}>
        <AvatarButton />
        {hideSearch ? (
          // The Shop tab has its own search input right below — showing
          // both pills stacked is a duplicate. Keep the row layout.
          <View style={{ flex: 1 }} />
        ) : (
          <Pressable
            onPress={() => router.push("/(tabs)/collections")}
            accessibilityLabel="Search the shop"
            style={({ pressed }) => [
              styles.searchPill,
              {
                backgroundColor: colors.input,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.textDim} />
            <Text
              style={[styles.searchText, { color: colors.textDim }]}
              numberOfLines={1}
            >
              Search the shop…
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push("/inbox")}
          hitSlop={8}
          accessibilityLabel="Open inbox"
          style={styles.iconBtn}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={colors.text}
          />
          {unreadCount > 0 && (
            <View
              style={[
                styles.badgeDot,
                {
                  backgroundColor: colors.danger,
                  borderColor: colors.header,
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => router.push("/ask-bea")}
          hitSlop={8}
          accessibilityLabel="Ask Bea"
          style={({ pressed }) => [
            styles.sparkleBtn,
            {
              backgroundColor: colors.text,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="sparkles" size={17} color={colors.background} />
        </Pressable>
        <CartButton />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { zIndex: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  avatarBtn: { borderRadius: Radius.pill },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 16, fontWeight: "800" },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchText: { fontSize: 14, fontWeight: "500" },
  iconBtn: { padding: 2 },
  badgeDot: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  sparkleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
