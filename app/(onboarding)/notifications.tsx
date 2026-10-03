/**
 * Onboarding: notifications.
 * The OS push prompt fires when this screen becomes the active screen
 * (focus trigger, after the slide-in finishes) — not on first load, when
 * iOS can swallow a prompt requested mid-transition, and not on Continue.
 * It fires once per arrival, only while the permission is still
 * undetermined. If iOS already has an answer (granted or denied in an
 * earlier install), no popup can appear; the screen says so and offers
 * the Settings route. Continue always moves forward.
 */
import React, { useCallback, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { PermissionScreen } from "../../components/PermissionScreen";
import {
  getPushPermissionStatus,
  registerPushToken,
  requestPushPermission,
  type PushPermissionStatus,
} from "../../lib/push";

export default function Notifications() {
  const router = useRouter();
  const [status, setStatus] = useState<PushPermissionStatus | null>(null);
  const firedRef = useRef(false);

  // Fire the OS popup when the screen becomes active (once, only while
  // undetermined). The short beat lets the slide-in transition settle so
  // iOS presents the prompt over this screen, not the previous one.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const current = await getPushPermissionStatus();
        if (cancelled) return;
        setStatus(current);
        if (current !== "undetermined" || firedRef.current) return;
        firedRef.current = true;
        await new Promise((res) => setTimeout(res, 400));
        if (cancelled) return;
        const next = await requestPushPermission();
        if (cancelled) return;
        setStatus(next);
        if (next === "granted") {
          await registerPushToken();
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const next = () =>
    router.push(
      // App Tracking Transparency is iOS-only — Android skips that screen.
      Platform.OS === "ios"
        ? "/(onboarding)/privacy"
        : "/(onboarding)/welcome"
    );

  const onContinue = async () => {
    // If the mount-time prompt never ran (or timed out), ask now instead.
    if (status === "undetermined" || status === null) {
      const result = await requestPushPermission();
      setStatus(result);
      if (result === "granted") {
        await registerPushToken();
      }
    }
    next();
  };

  const denied = status === "denied";

  return (
    <PermissionScreen
      icon="notifications-outline"
      title="Never Miss a Drop"
      body="Turn on notifications so you hear about new drops, restocks, and app-only sales the moment they land."
      bullets={[
        { icon: "flame-outline", text: "New products and collections" },
        { icon: "pricetag-outline", text: "Sales and app-only offers" },
        { icon: "close-circle-outline", text: "No spam — turn off anytime in Settings" },
      ]}
      primaryLabel="Continue"
      onPrimary={onContinue}
      secondaryLabel={denied ? "Update Device Settings" : undefined}
      onSecondary={
        denied
          ? () => {
              void Linking.openSettings();
            }
          : undefined
      }
      note={
        denied
          ? "The app can't override your physical device settings. If you want this changed, we recommend updating your device-specific settings for BeaTrackFam — the app refreshes every launch and will pick up your updated settings."
          : "You can change this anytime in Settings."
      }
    />
  );
}
