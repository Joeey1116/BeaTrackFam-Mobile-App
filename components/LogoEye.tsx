/** BeaTrackFam eye logo — adapts to the app theme.
 *
 * Light mode: black eye on a white circle.
 * Dark mode:  white eye on a black circle.
 */
import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { useTheme } from "./ThemeProvider";

const DARK_LOGO = require("../assets/logo-eye-circle.png");
const LIGHT_LOGO = require("../assets/logo-eye-circle-light.png");

export function LogoEye({
  size = 40,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const { isDark } = useTheme();
  return (
    <Image
      source={isDark ? DARK_LOGO : LIGHT_LOGO}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      accessibilityLabel="BeaTrackFam logo"
    />
  );
}
