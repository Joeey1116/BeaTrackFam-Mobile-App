import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "../../components/ThemeProvider";

/**
 * Bottom navigation is the OS's OWN tab bar (UITabBar on iOS, the
 * Material navigation bar on Android) instead of a hand-drawn pill.
 * On iOS 26 the system draws it as the floating Liquid Glass capsule
 * with the label under each icon — the genuine article, rendered by
 * Apple like the native switches and buttons, not an imitation.
 * (Swapped in Oct 4, 2026 at Joey's direction after two custom-bar
 * passes: "I want the built in... exactly like".)
 *
 * Two things come free with the system bar:
 * - Scrolling: iOS gives the first ScrollView in each tab automatic
 *   content insets, so the last rows (e.g. Delete Account) can scroll
 *   fully into view instead of hiding behind a floating overlay bar.
 * - The labels: laid out by the system, always on one line.
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      tintColor={colors.text}
      iconColor={{ default: colors.textDim, selected: colors.text }}
      labelStyle={{
        default: { color: colors.textDim, fontWeight: "500" },
        selected: { color: colors.text, fontWeight: "700" },
      }}
    >
      <NativeTabs.Trigger
        name="index"
        contentStyle={{ backgroundColor: colors.background }}
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="collections"
        contentStyle={{ backgroundColor: colors.background }}
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Label>Collections</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          md="grid_view"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="wishlist"
        contentStyle={{ backgroundColor: colors.background }}
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Label>Wishlist</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "heart", selected: "heart.fill" }}
          md="favorite"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="settings"
        contentStyle={{ backgroundColor: colors.background }}
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          md="person"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
