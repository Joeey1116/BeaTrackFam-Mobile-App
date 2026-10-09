/**
 * BeaTrackFam brand theme.
 *
 * Brand colors (confirmed Oct 1, 2026): black, white, light gray.
 * The App Store screenshots are the visual blueprint: light theme by default
 * (white background, light-gray cards, black buttons), with a dark mode
 * available via the header toggle (Joey's dark-background brand vibe).
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  input: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  button: string;
  buttonText: string;
  outlineButtonText: string;
  tabBar: string;
  header: string;
  danger: string;
  success: string;
  overlay: string;
  /** Theme-aware brand accent: deeper steel-blue on light, logo blue-gray on dark. */
  accent: string;
}

/** Matches the App Store preview screenshots — the default theme. */
export const LightColors: ThemeColors = {
  background: "#FFFFFF",
  surface: "#F6F6F6",
  surfaceRaised: "#FFFFFF",
  input: "#F1F1F1",
  border: "#E8E8E8",
  text: "#111111",
  textMuted: "#6E6E6E",
  textDim: "#9A9A9A",
  button: "#000000",
  buttonText: "#FFFFFF",
  outlineButtonText: "#111111",
  tabBar: "#FFFFFF",
  header: "#FFFFFF",
  danger: "#E5484D",
  success: "#1F9D55",
  overlay: "rgba(0,0,0,0.4)",
  /** Deeper steel-blue — readable on white (4.6:1), matches the logo's blue-gray family. */
  accent: "#5A7A8C",
};

/** Joey's dark brand vibe — available via the header theme toggle. */
export const DarkColors: ThemeColors = {
  background: "#000000",
  surface: "#161616",
  surfaceRaised: "#1E1E1E",
  input: "#1C1C1C",
  border: "#2A2A2A",
  text: "#FFFFFF",
  textMuted: "#B5B5B5",
  textDim: "#8A8A8A",
  button: "#FFFFFF",
  buttonText: "#000000",
  outlineButtonText: "#FFFFFF",
  tabBar: "#0A0A0A",
  header: "#000000",
  danger: "#F2555A",
  success: "#3FB96B",
  overlay: "rgba(0,0,0,0.6)",
  /** Logo blue-gray sampled from the logo background — glows on black (16.4:1). */
  accent: "#DFE4E8",
};

/** Brand constants (theme-independent). */
export const Brand = {
  black: "#000000",
  white: "#FFFFFF",
  lightGray: "#D3D3D3",
  /** Logo blue-gray sampled from the logo's background. Use `colors.accent`
   *  from the theme for UI (it's theme-aware); this is the raw brand color. */
  logoBlueGray: "#DFE4E8",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Type scale for the 12.0.0 redesign — Klarna-grade hierarchy:
 * heavy (800) headlines, generous sizes, tight tracking on the big
 * display lines. Spread into Text styles: {...Type.headline}.
 */
export const Type: Record<string, import("react-native").TextStyle> = {
  /** Hero greetings / auth titles. */
  display: { fontSize: 30, fontWeight: "800", lineHeight: 36, letterSpacing: -0.4 },
  /** Screen-level headlines (profile name, rail titles sit one step down). */
  headline: { fontSize: 24, fontWeight: "800", lineHeight: 30, letterSpacing: -0.3 },
  /** Section headers ("Newest drops", "There's more"). */
  section: { fontSize: 19, fontWeight: "800", lineHeight: 24 },
  /** Card + row titles. */
  title: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  /** Default body copy. */
  body: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  /** Small print under titles. */
  caption: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  /** "See all" / inline links. */
  link: { fontSize: 13, fontWeight: "700" },
  /** Uppercase kickers above sections. */
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
};

/**
 * Bottom padding for tab screens' scroll content. The iOS 26 floating
 * Liquid Glass tab bar (and Android's navigation bar in edge-to-edge)
 * overlays the bottom of the screen, and the native bar's automatic
 * inset doesn't reach screens whose ScrollView sits under a header —
 * without this clearance the last rows (About, Delete Account) hide
 * behind the bar. 128 ≈ capsule height + margins + breathing room.
 */
export const TabBarClearance = 128;
