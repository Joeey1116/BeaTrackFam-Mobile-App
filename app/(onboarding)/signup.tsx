/** Sign Up — create a BeaTrackFam account (registered with the accounts worker, so the login survives a reinstall). */
import React from "react";
import { AppAuthForm } from "../../components/AppAuthForm";

export default function Signup() {
  return <AppAuthForm mode="signup" />;
}
