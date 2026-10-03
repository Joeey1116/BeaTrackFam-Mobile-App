import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";

type BlurViewType = typeof import("expo-blur")["BlurView"];

/**
 * expo-blur is a native module, loaded lazily inside a try: on a native
 * build where it isn't linked the import throws, and the tab bar falls
 * back to a solid bar instead of crashing when the tabs mount.
 */

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const [BlurView, setBlurView] = useState<BlurViewType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("expo-blur");
        if (!cancelled) setBlurView(() => mod.BlurView);
      } catch {
        // Stay on the solid fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Liquid glass: frosted blur bar floating over scrolling content.
        // Falls back to a solid bar when blur isn't in this native build.
        tabBarBackground: () =>
          BlurView ? (
            <BlurView
              intensity={85}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            // No blur in this native build: still read as glass — a
            // translucent bar with a hairline edge, not a flat slab.
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.surface + "D9",
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            />
          ),
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isDark ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: "Collections",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isDark ? "grid" : "grid-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: "Wishlist",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isDark ? "heart" : "heart-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isDark ? "settings" : "settings-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
