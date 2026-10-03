/**
 * App Tracking Transparency (iOS-only).
 * Loaded lazily via dynamic import so web/Android bundles never evaluate the
 * native module — expo-tracking-transparency ships no web implementation and
 * throws at import time outside a native iOS build.
 */
import { Platform } from "react-native";

export type TrackingPermissionStatus =
  | "undetermined"
  | "restricted"
  | "denied"
  | "granted";

/** True only where the native ATT prompt can actually appear. */
export const TRACKING_AVAILABLE = Platform.OS === "ios";

async function loadModule() {
  if (!TRACKING_AVAILABLE) return null;
  return import("expo-tracking-transparency");
}

export async function getTrackingStatus(): Promise<TrackingPermissionStatus> {
  const mod = await loadModule();
  if (!mod) return "restricted";
  const { status } = await mod.getTrackingPermissionsAsync();
  return status as TrackingPermissionStatus;
}

export async function requestTrackingPermission(): Promise<TrackingPermissionStatus> {
  const mod = await loadModule();
  if (!mod) return "restricted";
  const { status } = await mod.requestTrackingPermissionsAsync();
  return status as TrackingPermissionStatus;
}
