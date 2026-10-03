/**
 * Push notifications — app-side client.
 *
 * ALL push-token traffic goes through the Cloudflare worker in
 * workers/push/, which stores tokens in KV and fans out broadcasts through
 * Expo's push API. See workers/push/README.md for setup.
 *
 * Until PUSH_WORKER_URL below is filled in, isPushConfigured() returns
 * false and registration stays completely dormant — no permission prompt,
 * no token fetch, no network calls, no crashes.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

/** Public URL of the deployed beatrackfam-push worker. Empty until set up. */
export const PUSH_WORKER_URL = "https://beatrackfam-push.contact-beatrackfam.workers.dev";

/** True only when push is fully configured — otherwise stay dormant. */
export function isPushConfigured(): boolean {
  return PUSH_WORKER_URL.trim().length > 0;
}

const PREF_KEY = "beatrackfam.push.enabled";

export type PushPermissionStatus = "undetermined" | "granted" | "denied";

function workerBase(): string {
  return PUSH_WORKER_URL.trim().replace(/\/+$/, "");
}

function isNative(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

type NotificationsModule = typeof import("expo-notifications");

let notificationsPromise: Promise<NotificationsModule | null> | null = null;

/**
 * Loads expo-notifications lazily, only on native. The module's JS calls
 * requireNativeModule() at evaluation time, so on a native build where it
 * isn't linked the import itself throws — the catch keeps push dormant
 * instead of crashing the app seconds after launch. On a linked build the
 * import succeeds and every feature works.
 */
async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!isNative()) return null;
  if (!notificationsPromise) {
    notificationsPromise = (async () => {
      try {
        return await import("expo-notifications");
      } catch {
        return null;
      }
    })();
  }
  return notificationsPromise;
}

/** User's on/off preference, persisted. Defaults to ON. */
export async function getPushPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export async function setPushPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, enabled ? "1" : "0");
  } catch {
    // Preference loss just means we ask again next launch — never fatal.
  }
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!isNative()) return "denied";
  const Notifications = await loadNotifications();
  if (!Notifications) return "denied";
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
  } catch {
    return "denied";
  }
}

/**
 * Shows the OS permission prompt (friendly — no alert dialogs on failure).
 * Returns the resulting status.
 */
export async function requestPushPermission(): Promise<PushPermissionStatus> {
  if (!isNative()) return "denied";
  const Notifications = await loadNotifications();
  if (!Notifications) return "denied";
  try {
    if (Platform.OS === "android") {
      // Android 13+ won't show the permission prompt until a channel exists.
      await Notifications.setNotificationChannelAsync("default", {
        name: "BeaTrackFam updates",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    // Never hang the caller: if the native prompt doesn't resolve quickly,
    // treat it as unanswered. The user can always grant it later.
    const timeout = new Promise<{ status: string }>((res) =>
      setTimeout(() => res({ status: "undetermined" }), 3000)
    );
    const { status } = await Promise.race([
      Notifications.requestPermissionsAsync(),
      timeout,
    ]);
    return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
  } catch {
    return "denied";
  }
}

async function getExpoPushToken(): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return typeof token === "string" && token.startsWith("ExponentPushToken[")
      ? token
      : null;
  } catch {
    return null;
  }
}

/**
 * Registers this device's Expo push token with the worker (upsert — safe to
 * call repeatedly). Returns true when the worker accepted the token.
 */
export async function registerPushToken(): Promise<boolean> {
  if (!isPushConfigured() || !isNative()) return false;
  const token = await getExpoPushToken();
  if (!token) return false;
  try {
    const res = await fetch(`${workerBase()}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Removes this device's token from the worker (best-effort). */
export async function unregisterPushToken(): Promise<void> {
  if (!isPushConfigured() || !isNative()) return;
  const token = await getExpoPushToken();
  if (!token) return;
  try {
    await fetch(`${workerBase()}/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best-effort only.
  }
}

/** Route a tapped notification to the right screen. */
function handleNotificationTap(data: Record<string, unknown> | undefined): void {
  try {
    if (data?.type === "product" && typeof data.id === "string" && data.id) {
      router.push(`/product/${data.id}`);
      return;
    }
    if (data?.type === "collection" && typeof data.id === "string" && data.id) {
      router.push({ pathname: "/collections", params: { collection: data.id } });
      return;
    }
    router.push("/");
  } catch {
    // Navigation not ready yet — the tap is simply ignored.
  }
}

/**
 * Call once from the root layout. Sets the foreground handler, registers
 * the token on launch (when the user opted in), re-registers on token
 * refresh, and routes notification taps — including taps that cold-start
 * the app.
 */
export function usePushNotifications(): void {
  useEffect(() => {
    if (!isPushConfigured() || !isNative()) return;

    let cancelled = false;
    let tokenSub: { remove: () => void } | null = null;
    let tapSub: { remove: () => void } | null = null;

    void (async () => {
      const Notifications = await loadNotifications();
      if (!Notifications || cancelled) return;

      // Foreground notifications show as a banner instead of being swallowed.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Cold start from a notification tap.
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (cancelled || !response) return;
        handleNotificationTap(
          response.notification.request.content.data as
            | Record<string, unknown>
            | undefined
        );
      } catch {
        // No previous tap — nothing to do.
      }
      if (cancelled) return;

      // Launch registration: only when the user left notifications on.
      const enabled = await getPushPreference();
      if (cancelled || !enabled) return;
      const status = await getPushPermissionStatus();
      if (cancelled) return;
      if (status === "granted") {
        await registerPushToken();
      }
      // "undetermined" or "denied" → stay quiet. The onboarding
      // notification screen asks; Settings can re-ask anytime.

      tokenSub = Notifications.addPushTokenListener(() => {
        // Token rolled — re-register the new one (upsert is idempotent).
        void registerPushToken();
      });
      tapSub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          handleNotificationTap(
            response.notification.request.content.data as
              | Record<string, unknown>
              | undefined
          );
        }
      );
    })();

    return () => {
      cancelled = true;
      tokenSub?.remove();
      tapSub?.remove();
    };
  }, []);
}
