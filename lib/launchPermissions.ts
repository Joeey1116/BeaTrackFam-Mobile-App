/**
 * Launch permission popup — location only.
 *
 * The notification prompt lives with the onboarding notification screen,
 * where the user sees it in context (it used to fire here on launch, which
 * also meant it only showed up after a crash-and-reopen cycle). Location
 * still asks once on launch, only while undetermined.
 *
 * expo-location is loaded lazily inside a try: its JS calls
 * requireNativeModule() at evaluation time, so on a native build where it
 * isn't linked the import throws — the catch keeps the app quiet instead
 * of killing it seconds after launch. On a linked build the popup fires.
 */
import { useEffect } from "react";
import { Platform } from "react-native";

type LocationModule = typeof import("expo-location");



export type LocationPermissionStatus = "granted" | "denied" | "undetermined";

/** Current location permission — read fresh on every call, never prompts. */
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  if (Platform.OS === "web") return "denied";
  try {
    const Location: LocationModule = await import("expo-location");
    const loc = await Location.getForegroundPermissionsAsync();
    if (loc.granted) return "granted";
    return loc.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

export function useLaunchPermissions(): void {

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    void (async () => {
      try {
        const Location: LocationModule = await import("expo-location");
        const loc = await Location.getForegroundPermissionsAsync();
        if (!cancelled && !loc.granted && loc.canAskAgain) {
          await Location.requestForegroundPermissionsAsync();
        }
      } catch {
        // Module unlinked or permission API unavailable — stay quiet.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
