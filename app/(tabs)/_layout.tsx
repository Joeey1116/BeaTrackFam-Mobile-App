import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../components/ThemeProvider";

type BlurViewType = typeof import("expo-blur")["BlurView"];

/**
 * expo-blur is a native module, loaded lazily inside a try: on a native
 * build where it isn't linked the import throws, and the tab bar falls
 * back to a translucent pill instead of crashing when the tabs mount.
 * (Crash-safety rule: no static native imports on the launch path, and
 * no TurboModuleRegistry name probe gating the lazy import.)
 */

const PILL_RADIUS = 30;
const PILL_HEIGHT = 60;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  outlineName,
  color,
  focused,
  isDark,
}: {
  name: IconName;
  outlineName: IconName;
  color: ColorValue;
  focused: boolean;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.iconPill,
        focused && {
          backgroundColor: isDark
            ? "rgba(255,255,255,0.16)"
            : "rgba(0,0,0,0.07)",
        },
      ]}
    >
      <Ionicons name={focused ? name : outlineName} size={24} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [BlurView, setBlurView] = useState<BlurViewType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("expo-blur");
        if (!cancelled) setBlurView(() => mod.BlurView);
      } catch {
        // Stay on the translucent fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Real blur only where it exists: expo-blur on iOS renders the system
  // frosted-glass material. On Android (or a build without blur linked)
  // the pill uses the translucent tint — same shape, no fake blur.
  const showBlur = BlurView !== null && Platform.OS === "ios";
  const bottomOffset = Math.max(insets.bottom + 4, 16);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Liquid glass pill: a frosted capsule floating over content,
        // detached from the screen edges (Instagram-style), with a light
        // wash + hairline edge so the glass reads even over black.
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, styles.shadowWrap]}>
            <View style={[StyleSheet.absoluteFill, styles.clip]}>
              {showBlur && BlurView ? (
                <BlurView
                  intensity={75}
                  tint={isDark ? "dark" : "light"}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: isDark
                        ? "rgba(20,20,24,0.85)"
                        : "rgba(250,250,252,0.88)",
                    },
                  ]}
                />
              )}
              {/* Tint wash: keeps the glass visible on dark screens,
                  where a bare blur of black would look like a slab. */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.22)",
                  },
                ]}
              />
              {/* Hairline glass edge. */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.ring,
                  {
                    borderColor: isDark
                      ? "rgba(255,255,255,0.16)"
                      : "rgba(0,0,0,0.08)",
                  },
                ]}
              />
            </View>
          </View>
        ),
        tabBarStyle: {
          position: "absolute",
          left: 18,
          right: 18,
          bottom: bottomOffset,
          height: PILL_HEIGHT,
          borderRadius: PILL_RADIUS,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="home"
              outlineName="home-outline"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: "Collections",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="grid"
              outlineName="grid-outline"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: "Wishlist",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="heart"
              outlineName="heart-outline"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="settings"
              outlineName="settings-outline"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: PILL_RADIUS,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  clip: {
    borderRadius: PILL_RADIUS,
    overflow: "hidden",
  },
  ring: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: PILL_RADIUS,
  },
  iconPill: {
    paddingHorizontal: 17,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
