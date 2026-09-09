#!/usr/bin/env bash
# Bootstrap a Mac/Linux PC to develop Halo (Expo / React Native) after git clone.
#
# Purpose: verify tools, optionally install Node/JDK via Homebrew, then npm install.
# Inputs:  --install-tools   brew install node and openjdk@17 if missing (macOS).
# Outputs: checklist on stdout; exit 0 if npm install succeeded.
# Side effects: may brew install; always npm install in mobileApp.
# Design: Expo/EAS stay on npx. Does not run eas login. Does not install Android Studio.
#         Never downloads random binaries; brew only with --install-tools.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

INSTALL_TOOLS=0
for arg in "$@"; do
  case "$arg" in
    --install-tools|-InstallTools)
      INSTALL_TOOLS=1
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: ./scripts/setup-dev.sh [--install-tools]" >&2
      exit 1
      ;;
  esac
done

echo "Halo setup — $APP_ROOT"
echo

WARN=0
HARD_FAIL=0

ok() { echo "  OK    $1"; }
warn() { WARN=$((WARN + 1)); echo "  WARN  $1"; }
fail() { HARD_FAIL=1; echo "  FAIL  $1" >&2; }
hint() { echo "        $1"; }

required_node="20.18.0"
if [[ -f package.json ]]; then
  extracted="$(tr '\n' ' ' < package.json | sed -n 's/.*"engines"[[:space:]]*:[[:space:]]*{[[:space:]]*"node"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [[ "$extracted" =~ ([0-9]+\.[0-9]+(\.[0-9]+)?) ]]; then
    required_node="${BASH_REMATCH[1]}"
  fi
fi

version_ge() {
  # Purpose: true if $1 >= $2 (dotted numeric). Inputs: have, need. Side effects: none.
  local lowest
  lowest="$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)"
  [[ "$lowest" == "$2" ]]
}

install_with_brew() {
  # Purpose: brew install a formula when --install-tools and brew exist.
  local formula="$1"
  local label="$2"
  if [[ "$INSTALL_TOOLS" -ne 1 ]]; then
    hint "Re-run with --install-tools to brew install ${formula}."
    return 1
  fi
  if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew not found; cannot auto-install ${label}."
    hint "https://brew.sh  then:  brew install ${formula}"
    return 1
  fi
  echo "Installing ${label} via Homebrew (${formula})..."
  brew install "$formula"
}

echo "Checking tools..."
echo

if command -v git >/dev/null 2>&1; then
  ok "$(git --version)"
else
  warn "Git not on PATH."
  hint "macOS: xcode-select --install   Linux: install git from your package manager."
fi

have_node=""
if command -v node >/dev/null 2>&1; then
  have_node="$(node -p "process.versions.node" 2>/dev/null || true)"
fi

if [[ -n "$have_node" ]] && version_ge "$have_node" "$required_node"; then
  ok "Node.js ${have_node} (need ${required_node}+)"
  if command -v npm >/dev/null 2>&1; then
    ok "npm (ships with Node.js)"
  else
    fail "npm missing even though node is present. Repair the Node.js install."
  fi
else
  if [[ -n "$have_node" ]]; then
    fail "Node.js ${have_node} is too old (need ${required_node}+ for Expo SDK 57)."
  else
    fail "Node.js not found (need ${required_node}+ for Expo SDK 57)."
  fi
  hint "Download LTS: https://nodejs.org"
  hint "macOS:  brew install node"
  if install_with_brew node "Node.js"; then
    have_node="$(command -v node >/dev/null 2>&1 && node -p "process.versions.node" || true)"
    if [[ -n "$have_node" ]] && version_ge "$have_node" "$required_node" && command -v npm >/dev/null 2>&1; then
      HARD_FAIL=0
      ok "Node.js ${have_node} after brew install"
    else
      fail "Node.js still missing or too old after brew install. Open a new terminal or see https://nodejs.org"
    fi
  fi
fi

java_major=""
if command -v java >/dev/null 2>&1; then
  java_out="$(java -version 2>&1 || true)"
  if [[ "$java_out" =~ version[[:space:]]+\"1\.([0-9]+) ]]; then
    java_major="${BASH_REMATCH[1]}"
  elif [[ "$java_out" =~ version[[:space:]]+\"([0-9]+) ]]; then
    java_major="${BASH_REMATCH[1]}"
  fi
fi

jbr=""
for candidate in \
  "${JAVA_HOME:-}" \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  "${HOME}/Library/Java/JavaVirtualMachines" \
  "/opt/homebrew/opt/openjdk@17" \
  "/usr/lib/jvm/java-17-openjdk"
do
  if [[ -n "$candidate" && -x "$candidate/bin/java" ]]; then
    jbr="$candidate"
    break
  fi
done

if [[ "$java_major" == "17" ]]; then
  ok "Java 17 on PATH (good for local Android builds)"
elif [[ -n "$jbr" ]]; then
  ok "JDK 17 found at $jbr"
  hint "Set JAVA_HOME to that folder for local Gradle builds."
else
  if [[ -n "$java_major" ]]; then
    warn "Java ${java_major} on PATH; Expo local Android builds expect JDK 17."
  else
    warn "Java / JDK not found. Needed only for local APK / expo run:android (not npm start)."
  fi
  hint "Android Studio JBR is enough, or:  brew install openjdk@17"
  install_with_brew openjdk@17 "OpenJDK 17" || true
fi

sdk=""
for candidate in \
  "${ANDROID_HOME:-}" \
  "${ANDROID_SDK_ROOT:-}" \
  "${HOME}/Library/Android/sdk" \
  "${HOME}/Android/Sdk"
do
  if [[ -n "$candidate" && -d "$candidate" ]]; then
    if [[ -x "$candidate/platform-tools/adb" || -x "$candidate/emulator/emulator" ]]; then
      sdk="$candidate"
      break
    fi
  fi
done

if [[ -z "$sdk" ]]; then
  warn "Android SDK not found (needed for emulator / local APK, not for npm start)."
  hint "Install Android Studio, then SDK + one AVD in Device Manager."
  hint "Typical: macOS ~/Library/Android/sdk  Linux ~/Android/Sdk"
  hint "This script does not install Android Studio."
else
  ok "Android SDK: $sdk"
  if [[ -x "$sdk/platform-tools/adb" ]]; then
    ok "adb (platform-tools)"
  else
    warn "adb missing. Install Android SDK Platform-Tools in SDK Manager."
  fi
  EMU="$sdk/emulator/emulator"
  if [[ -x "$EMU" ]]; then
    ok "emulator"
    avds="$("$EMU" -list-avds 2>/dev/null | tr -d '\r' | sed '/^$/d' | paste -sd ', ' - || true)"
    if [[ -n "$avds" ]]; then
      ok "AVDs: $avds"
    else
      warn "No AVDs. Create one in Android Studio Device Manager, then npm run emu."
    fi
  else
    warn "emulator missing. Install Android Emulator in SDK Manager."
  fi
fi

echo

if [[ "$HARD_FAIL" -ne 0 ]]; then
  echo "Cannot npm install until Node.js (${required_node}+) is available." >&2
  echo "Fix Node, then:  ./scripts/setup-dev.sh --install-tools"
  exit 1
fi

echo "Installing npm packages (npm install)..."
npm install
ok "npm install"
hint "Expo CLI: npx expo   EAS CLI: npx eas-cli   (no global install needed)"

echo "Checking Expo native module versions (npx expo install --check)..."
if npx --yes expo install --check; then
  ok "expo install --check (native modules match SDK 57)"
else
  warn "expo install --check reported a mismatch. Pinned versions in package.json may still be fine."
fi

echo
echo "Next commands (from mobileApp):"
echo "  npm start          Expo (then a / i / w)"
echo "  npm run emu        local Android emulator"
echo "  npm run apk        EAS preview APK (first time: npx eas-cli login — not run by setup)"
echo
if [[ "$WARN" -gt 0 ]]; then
  echo "Setup finished with ${WARN} warning(s). Web/Metro can still run; fix WARN items for emulator/APK."
else
  echo "Setup finished. This PC is ready to develop Halo."
fi
echo
echo "npm run setup is Windows-oriented. On macOS/Linux use this script directly."
