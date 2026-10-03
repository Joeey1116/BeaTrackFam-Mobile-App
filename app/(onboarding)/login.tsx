/** Log In — BeaTrackFam app account sign-in (device-local, no Shopify dependency). */
import React from "react";
import { AppAuthForm } from "../../components/AppAuthForm";

export default function Login() {
  return <AppAuthForm mode="login" />;
}
