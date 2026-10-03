import { Redirect } from "expo-router";

export default function Index() {
  // TODO: when auth is wired, check session here — signed-in users go
  // straight to /(tabs), everyone else sees onboarding once.
  return <Redirect href="/(onboarding)" />;
}
