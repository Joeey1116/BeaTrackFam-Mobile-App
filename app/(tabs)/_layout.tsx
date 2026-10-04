import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../components/ThemeProvider";

/** Minimal shape of the props React Navigation hands a custom tab bar. */
type GlassTabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string; params?: object }[];
  };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarAccessibilityLabel?: string;
        tabBarIcon?: (props: {
          focused: boolean;
          color: string;
          size: number;
        }) => React.ReactNode;
      };
    }
  >;
  navigation: {
    emit(event: {
      type: string;
      target?: string;
      canPreventDefault?: boolean;
    }): unknown;
    navigate(name: string, params?: object): void;
  };
};

type BlurViewType = typeof import("expo-blur")["BlurView"];

/**
 * expo-blur is a native module, loaded lazily inside a try: on a native
 * build where it isn't linked the import throws, and the tab bar falls
 * back to a translucent pill instead of crashing when the tabs mount.
 * (Crash-safety rule: no static native imports on the launch path, and
 * no TurboModuleRegistry name probe gating the lazy import.)
 */

const PILL_RADIUS = 35;
const PILL_HEIGHT = 70;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  outlineName,
  label,
  color,
  focused,
  isDark,
}: {
  name: IconName;
  outlineName: IconName;
  label: string;
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
      <Ionicons name={focused ? name : outlineName} size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

/**
 * Floating liquid-glass pill tab bar (Instagram-style): a frosted capsule
 * detached from the screen edges, floating over scrolling content, with
 * a light wash + hairline edge so the glass reads even over black.
 * Fully custom bar (not the stock one) so the icon + label group sits
 * dead-center in the pill with the highlight wrapped around both.
 */
function GlassTabBar({ state, descriptors, navigation }: GlassTabBarProps) {
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
    <View style={[styles.bar, { bottom: bottomOffset }]}>
      {/* Glass background: shadow shell + clipped blur/tint + edge. */}
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

      {state.routes.map((route, index) => {
        const options = descriptors[route.key].options;
        const focused = state.index === index;
        const color = focused ? colors.text : colors.textDim;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          }) as { defaultPrevented?: boolean };
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={
              options.tabBarAccessibilityLabel ?? options.title ?? route.name
            }
            style={styles.tab}
          >
            {options.tabBarIcon?.({ focused, color, size: 22 })}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { isDark } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="home"
              outlineName="home-outline"
              label="Home"
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
              label="Collections"
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
              label="Wishlist"
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
              label="Settings"
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
  bar: {
    position: "absolute",
    left: 18,
    right: 18,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
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
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  iconPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
});
