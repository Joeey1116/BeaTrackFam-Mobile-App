This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Versioning (Joey's convention)

Every new release bumps the **major** version by one and the build number by 100: **7.0.0 (700) → 8.0.0 (800) → 9.0.0 (900)** — unless Joey says otherwise. Keep these in sync on every bump:

- `app.json`: `version`, `ios.buildNumber`, `android.versionCode`
- `app/settings/app-settings.tsx`: version subtitle
- `app/settings/about.tsx`: version line
- `assets/splash.png`: small bottom label "Build 700 (7.0.0)" (regenerate per release — clone nearby fabric texture over the old label, don't flat-fill)
- Distribution zip name: `beatrackfam-app-v8.1.5.zip` (bump for each new file sent)
- Standing rule (Joey, Oct 1 2026): bump the version EVERY time a new project file/zip is sent to him — currently 8.1.5 (815).
- Location permission is asked ON LAUNCH via the OS popup (lib/launchPermissions.ts, linkage-probed lazy import) — the onboarding location screen was deleted Oct 1 2026 at Joey's request (his earlier Apple-requirement note is superseded). The app-tracking/privacy onboarding screen stays (Apple-required). No "Skip for Now" button on the notification permission screen. Notification prompt fires WITH the onboarding notification screen (re-added Oct 2 2026 at Joey's request; popup on screen mount, only while undetermined) — it no longer fires on launch.
- Crash-safety rule (Oct 2 2026): never statically import a native-only Expo module (expo-notifications, expo-location, expo-blur, checkout-sheet-kit) at the top of a launch-path file — lazy dynamic-import inside try/catch instead. A static import throws at bundle-evaluation time on an older dev build running newer JS and kills the app seconds after launch. Do NOT gate the lazy import on a TurboModuleRegistry/NativeModules name probe for Expo packages (they split into multiple native modules and names vary): a wrong probe silently disables the popups — Oct 2 2026 the probe stopped the location + notification popups from ever firing. The checkout-sheet-kit keeps its probe because it is a third-party RN module with one stable name.
- After every version bump is complete, send Joey the "What's New" notes copy-paste ready (plain text, never a code block). Every version's notes end with: "Questions or concerns? Email us at contact@beatrackfam.info"

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
