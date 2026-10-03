import { Redirect } from "expo-router";
import { useShop } from "../store/shop";

export default function Index() {
  const { account, authLoading, onboardingDone } = useShop();

  // Wait until the saved session (and onboarding state) has been
  // restored from storage before picking a route — a signed-in user
  // must never be thrown back into onboarding on a cold start just
  // because the restore hadn't finished yet.
  if (authLoading) return null;

  return (
    <Redirect href={account || onboardingDone ? "/(tabs)" : "/(onboarding)"} />
  );
}
