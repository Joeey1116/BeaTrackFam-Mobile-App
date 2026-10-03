/**
 * Onboarding completion flag — persisted so returning users skip the
 * intro flow and land straight in the shop on cold start.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_DONE_KEY = "beatrackfam-onboarding-done-v1";

export async function getOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_DONE_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_DONE_KEY, "1").catch(() => {});
}
