#!/usr/bin/env bash
# Build a sideloadable Android APK for Halo (com.halo.journal).
#
# Preferred: EAS cloud preview APK (download URL from CLI / expo.dev).
# Local debug: ./scripts/build-apk.sh --local-debug
#   → android/app/build/outputs/apk/debug/app-debug.apk
#
# First time: npx eas-cli login  (Expo account; credentials are not committed).
# No generated keystore, no committed secrets. Do not assembleRelease without YOUR keystore.
#
# Local needs JAVA_HOME (JDK 17) and ANDROID_HOME or ANDROID_SDK_ROOT.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

LOCAL_DEBUG=0
if [[ "${1:-}" == "--local-debug" ]]; then
  LOCAL_DEBUG=1
fi

echo "Halo APK — $APP_ROOT (com.halo.journal)"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (20.18+ for Expo SDK 57). https://nodejs.org" >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing npm dependencies..."
  npm install
fi

echo "Expo account: first time run  npx eas-cli login  (not stored in git)."
echo

if [[ "$LOCAL_DEBUG" -eq 1 ]]; then
  if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
    echo "ANDROID_HOME or ANDROID_SDK_ROOT is not set. Omit --local-debug to use EAS." >&2
    exit 1
  fi
  echo "Local debug APK: prebuild + assembleDebug (no release keystore)."
  npx --yes expo prebuild --platform android --non-interactive
  (cd android && ./gradlew assembleDebug)
  echo
  echo "Local debug APK folder: $APP_ROOT/android/app/build/outputs/apk/debug"
  echo "Typical file: app-debug.apk"
  exit 0
fi

echo "Starting EAS preview APK (cloud). If auth fails:  npx eas-cli login"
echo

if ! npx --yes eas-cli whoami; then
  echo "Not logged in. Run:  npx eas-cli login   then re-run." >&2
  exit 1
fi

npx --yes eas-cli build -p android --profile preview

echo
echo "EAS APK: download the URL the CLI printed (expo.dev → Builds)."
echo "Install on her phone (allow this source). Preview APK is not Play-signed."
