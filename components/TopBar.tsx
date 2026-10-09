/**
 * TopBar — the 12.0.0 redesign's main-screen header.
 *
 * Layout (Klarna/top-shopping-app structure, BeaTrackFam black & white):
 * circular avatar w/ initial → wide pill search → bell (Inbox) + Ask Bea
 * sparkle + cart. Used on the four tab screens. The Inbox badge stays
 * hidden until real inbox data lands in Phase 2 (unreadCount = 0).
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

export function TopBar({ unreadCount = 0 }: { unreadCount?: number }) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.header }]}
    >
      <View style={styles.row}>
        <AvatarButton />
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
            />
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
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  sparkleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
