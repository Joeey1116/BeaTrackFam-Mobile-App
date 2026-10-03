/** Sign Up — create a BeaTrackFam app account (device-local, no Shopify dependency). */
import React from "react";
import { AppAuthForm } from "../../components/AppAuthForm";

export default function Signup() {
  return <AppAuthForm mode="signup" />;
}
