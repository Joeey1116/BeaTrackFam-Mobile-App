#!/bin/sh
# Xcode Cloud post-clone script for BeaTrackFam (Expo, SDK 57).
# Runs on Apple's machines after every clone: installs Node + JS deps,
# regenerates the native iOS project fresh from app.json (expo prebuild),
# then installs CocoaPods. The full ios/ project is NOT committed — only the
# project skeleton + shared scheme are tracked so Xcode Cloud can find them.
set -e

# Xcode Cloud exports CI=TRUE (uppercase), which crashes Expo's env parsing
# ("GetEnv.NoBoolean: TRUE is not a boolean"). Force lowercase for our tools.
export CI=true

# Script lives in ios/ci_scripts; repo root is two levels up.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Quiet, deterministic Homebrew (Xcode Cloud images don't ship Node.js).
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
if ! command -v node >/dev/null 2>&1; then
  brew install node
fi
if ! command -v pod >/dev/null 2>&1; then
  brew install cocoapods
fi

# JS dependencies (package-lock.json is committed, so npm ci is exact).
npm ci

# Regenerate the native project from app.json. This stamps version/build
# from app.json (ios.buildNumber) into Info.plist — app.json stays the
# single source of truth; bump it before every store-bound run.
npx expo prebuild -p ios --no-install

# CocoaPods (creates BeaTrackFam.xcworkspace used by the workflow).
cd ios
pod install
