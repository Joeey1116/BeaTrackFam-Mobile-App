/** Cart button with badge — used in headers across the app. */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "./ThemeProvider";
import { useShop } from "../store/shop";

export function CartButton() {
  const { colors } = useTheme();
  const router = useRouter();
  const { cartCount } = useShop();

  return (
    <Pressable
      onPress={() => router.push("/cart")}
      hitSlop={12}
      accessibilityLabel="Open cart"
      style={styles.wrap}
    >
      <Ionicons name="cart-outline" size={24} color={colors.text} />
      {cartCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.text }]}>
          <Text
            style={[styles.badgeText, { color: colors.background }]}
            numberOfLines={1}
          >
            {cartCount > 99 ? "99+" : String(cartCount)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 4 },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "800" },
});
