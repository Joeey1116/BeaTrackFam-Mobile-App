/**
 * Onboarding: privacy / app tracking.
 * Apple's tracking prompt fires when this screen becomes active (focus
 * trigger, same as notifications). A Grant Permission button is always
 * there as the manual route, and Continue stays grayed out until the
 * prompt has been answered — then the screen shows "Tracking Allowed" or
 * "Not Allowed" and Continue unlocks. If tracking was already answered in
 * an earlier install, the recorded answer shows and Continue works right
 * away. On Android/web there is no ATT prompt; the screen explains that
 * and continues freely.
 */
import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { PermissionScreen } from "../../components/PermissionScreen";
import { OutlineButton } from "../../components/ui";
import { useTheme } from "../../components/ThemeProvider";
import {
  TRACKING_AVAILABLE,
  getTrackingStatus,
  requestTrackingPermission,
  type TrackingPermissionStatus,
} from "../../lib/tracking";
import { Spacing } from "../../constants/theme";

export default function Privacy() {
  const router = useRouter();
  const { colors } = useTheme();
  const [status, setStatus] = useState<TrackingPermissionStatus | null>(
    TRACKING_AVAILABLE ? null : "restricted"
  );
  const firedRef = useRef(false);

  const applyStatus = (s: TrackingPermissionStatus) => setStatus(s);

  // Fire the OS popup when the screen becomes active (once, only while
  // undetermined), with a short beat so the slide-in settles first.
  useFocusEffect(
    useCallback(() => {
      if (!TRACKING_AVAILABLE) return;
      let cancelled = false;
      void (async () => {
        const current = await getTrackingStatus();
        if (cancelled) return;
        applyStatus(current);
        if (current !== "undetermined" || firedRef.current) return;
        firedRef.current = true;
        await new Promise((res) => setTimeout(res, 400));
        if (cancelled) return;
        const next = await requestTrackingPermission();
        if (!cancelled) applyStatus(next);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onGrant = async () => {
    if (!TRACKING_AVAILABLE) return;
    const current = status ?? (await getTrackingStatus());
    if (current !== "undetermined") {
      applyStatus(current);
      return;
    }
    const next = await requestTrackingPermission();
    applyStatus(next);
  };

  const answered = status !== null && status !== "undetermined";
  const next = () => router.push("/(onboarding)/welcome");

  return (
    <PermissionScreen
      icon="shield-checkmark-outline"
      title="Your Privacy Matters"
      body="BeaTrackFam respects your privacy. You can choose whether to allow the app to track activity for a more personalized experience."
      bullets={[
        { icon: "eye-off-outline", text: "We never sell your personal data" },
        { icon: "lock-closed-outline", text: "Checkout stays secure with Shopify" },
        { icon: "options-outline", text: "Change your mind anytime in Settings" },
      ]}
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={TRACKING_AVAILABLE && !answered}
      note={
        TRACKING_AVAILABLE
          ? answered
            ? undefined
            : "Grant permission to continue."
          : "Ad tracking is managed in your device's system settings."
      }
    >
      {TRACKING_AVAILABLE && (
        <View style={styles.grantWrap}>
          <OutlineButton
            label="Grant Permission"
            onPress={onGrant}
            disabled={answered}
          />
          {answered && (
            <Text style={[styles.statusText, { color: colors.text }]}>
              {status === "granted" ? "Tracking Allowed" : "Not Allowed"}
            </Text>
          )}
        </View>
      )}
    </PermissionScreen>
  );
}

const styles = StyleSheet.create({
  grantWrap: { marginTop: Spacing.lg, alignSelf: "stretch", gap: Spacing.md },
  statusText: { fontSize: 15, fontWeight: "700", textAlign: "center" },
});
