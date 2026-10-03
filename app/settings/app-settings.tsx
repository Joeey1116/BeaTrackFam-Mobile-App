/** App Settings — permission statuses, app info, in-app policies. */
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeProvider";
import { ScreenHeader, SectionLabel, SettingRow } from "../../components/ui";
import {
  TRACKING_AVAILABLE,
  getTrackingStatus,
  type TrackingPermissionStatus,
} from "../../lib/tracking";
import {
  getPushPermissionStatus,
  getPushPreference,
  setPushPreference,
  requestPushPermission,
  registerPushToken,
  unregisterPushToken,
  type PushPermissionStatus,
} from "../../lib/push";
import {
  getLocationPermissionStatus,
  type LocationPermissionStatus,
} from "../../lib/launchPermissions";
import { POLICY_ORDER, POLICIES } from "../../data/policies";
import { Spacing } from "../../constants/theme";

const TRACKING_LABELS: Record<TrackingPermissionStatus, string> = {
  granted: "Allowed",
  denied: "Not Allowed",
  restricted: "Restricted",
  undetermined: "Not asked yet",
};

const PLATFORM_LABEL =
  Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web";

const DEVICE_NOTE =
  "The app can't override your physical device settings. If you want this changed, we recommend updating your device-specific settings for BeaTrackFam — the app refreshes every launch and will pick up your updated settings.";

export default function AppSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const [trackingStatus, setTrackingStatus] =
    useState<TrackingPermissionStatus | null>(null);
  const [pushOsStatus, setPushOsStatus] = useState<PushPermissionStatus | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationPermissionStatus | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);

  // Statuses are read fresh on every call: the app reflects whatever the
  // device says right now — at launch, on screen focus, and when the user
  // returns from the device Settings.
  const refresh = useCallback(async () => {
    const [tracking, osStatus, pref, location] = await Promise.all([
      getTrackingStatus().catch(() => null),
      getPushPermissionStatus(),
      getPushPreference(),
      getLocationPermissionStatus(),
    ]);
    if (tracking) setTrackingStatus(tracking);
    setPushOsStatus(osStatus);
    setPushEnabled(pref);
    setLocationStatus(location);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const onTogglePush = async (value: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!value) {
        // Toggle off → notifications off in the app, whatever the OS says.
        await setPushPreference(false);
        setPushEnabled(false);
        await unregisterPushToken();
        return;
      }
      // Toggle on → ask the OS if we've never asked; then mirror reality.
      let osStatus = pushOsStatus;
      if (osStatus === "undetermined" || osStatus === null) {
        osStatus = await requestPushPermission();
        setPushOsStatus(osStatus);
      }
      if (osStatus === "granted") {
        await setPushPreference(true);
        setPushEnabled(true);
        await registerPushToken();
      } else {
        // The OS says no — the app can't override the physical device.
        // The toggle snaps back off; Update Device Settings is below.
        await setPushPreference(false);
        setPushEnabled(false);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const pushSubtitle =
    pushOsStatus === null
      ? "Checking…"
      : pushOsStatus === "granted"
        ? pushEnabled
          ? "Allowed"
          : "Disabled"
        : pushOsStatus === "denied"
          ? "Not Allowed"
          : "Not asked yet";

  const locationSubtitle =
    locationStatus === null
      ? "Checking…"
      : locationStatus === "granted"
        ? "Allowed"
        : locationStatus === "denied"
          ? "Not Allowed"
          : "Not asked yet";

  const anyDenied =
    pushOsStatus === "denied" ||
    locationStatus === "denied" ||
    (TRACKING_AVAILABLE && trackingStatus === "denied");

  const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) => (
    <Ionicons name={name} size={20} color={colors.text} />
  );

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="App Settings" align="center" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel text="PERMISSIONS" />
        <SettingRow
          icon={icon("notifications-outline")}
          title="Push Notifications"
          subtitle={pushSubtitle}
          right={
            <Switch
              value={pushEnabled && pushOsStatus === "granted"}
              onValueChange={onTogglePush}
              disabled={pushBusy}
              accessibilityLabel="Toggle push notifications"
            />
          }
        />
        <SettingRow
          icon={icon("shield-checkmark-outline")}
          title="App Tracking"
          subtitle={
            TRACKING_AVAILABLE
              ? trackingStatus
                ? TRACKING_LABELS[trackingStatus]
                : "Checking…"
              : "Managed in system settings"
          }
        />
        <SettingRow
          icon={icon("location-outline")}
          title="Location"
          subtitle={locationSubtitle}
        />
        {anyDenied && (
          <SettingRow
            icon={icon("settings-outline")}
            title="Update Device Settings"
            subtitle="Open BeaTrackFam in your device settings"
            onPress={() => {
              void Linking.openSettings();
            }}
          />
        )}
        <Text style={[styles.deviceNote, { color: colors.textDim }]}>
          {DEVICE_NOTE}
        </Text>

        <SectionLabel text="APP INFO" />
        <SettingRow
          icon={icon("eye-outline")}
          title="App Name"
          subtitle="BeaTrackFam: Loyalty Above All"
        />
        <SettingRow
          icon={icon("information-circle-outline")}
          title="Version"
          subtitle="8.1.5 (Build 815)"
        />
        <SettingRow
          icon={icon("phone-portrait-outline")}
          title="Platform"
          subtitle={PLATFORM_LABEL}
        />

        <SectionLabel text="POLICIES" />
        {POLICY_ORDER.map((slug) => (
          <SettingRow
            key={slug}
            icon={icon("document-text-outline")}
            title={POLICIES[slug].title}
            subtitle="Read in the app"
            onPress={() => router.push(`/settings/policies/${slug}`)}
          />
        ))}

        <Text style={[styles.note, { color: colors.textDim }]}>
          Policies open inside the app — nothing here opens a browser.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  note: { fontSize: 12, textAlign: "center", marginTop: Spacing.lg },
  deviceNote: { fontSize: 12, lineHeight: 17, marginTop: Spacing.sm },
});
