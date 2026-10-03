import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../components/ThemeProvider";
import { ShopProvider } from "../store/shop";
import { usePushNotifications } from "../lib/push";
import { useLaunchPermissions } from "../lib/launchPermissions";

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  usePushNotifications();
  useLaunchPermissions();
  return (
    <ThemeProvider>
      <ShopProvider>
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="thank-you" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="cart" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/addresses" />
          <Stack.Screen name="profile/interests" />
          <Stack.Screen name="profile/socials" />
          <Stack.Screen name="settings/design-request" />
          <Stack.Screen name="settings/support" />
          <Stack.Screen name="settings/faq" />
          <Stack.Screen name="settings/order-history" />
          <Stack.Screen name="settings/order/[id]" />
          <Stack.Screen name="settings/app-settings" />
          <Stack.Screen name="settings/delete-account" />
          <Stack.Screen name="settings/about" />
          <Stack.Screen name="settings/policies/[slug]" />
        </Stack>
      </ShopProvider>
    </ThemeProvider>
  );
}
