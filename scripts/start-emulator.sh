#!/usr/bin/env bash
# Boot a local Android emulator and start Halo (Expo) against it.
#
# Purpose: run Halo on a local AVD without cloud, EAS, or a physical phone.
# Inputs:  --avd <name>   optional AVD (default: Pixel_9a if present, else first)
#          --clear        Metro cache (expo start --clear --android)
#          --local-debug  native expo run:android (same idea as build-apk.sh --local-debug)
#          --gpu <mode>   host | auto | swiftshader_indirect (default auto)
#          --snapshot     load a quick-boot snapshot (default: -no-snapshot-load)
# Outputs: Metro in this terminal; emulator process stays running.
# Side effects: may npm install, start an emulator, export ANDROID_HOME for this session.
#
# Package: com.halo.journal. Default path is expo start --android (Expo Go).
# Override example: ./scripts/start-emulator.sh --avd Medium_Phone_API_36.1
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

AVD=""
CLEAR=0
LOCAL_DEBUG=0
SNAPSHOT=0
GPU="auto"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --avd|-Avd)
      AVD="${2:-}"
      if [[ -z "$AVD" ]]; then
        echo "Missing value for $1" >&2
        exit 1
      fi
      shift 2
      ;;
    --clear|-Clear|-c)
      CLEAR=1
      shift
      ;;
    --local-debug|-LocalDebug)
      LOCAL_DEBUG=1
      shift
      ;;
    --gpu|-Gpu)
      GPU="${2:-}"
      case "$GPU" in
        host|auto|swiftshader_indirect) ;;
        *)
          echo "Invalid --gpu. Use host, auto, or swiftshader_indirect." >&2
          exit 1
          ;;
      esac
      shift 2
      ;;
    --snapshot|-Snapshot)
      SNAPSHOT=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "Halo emulator - $APP_ROOT (com.halo.journal)"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (20.18+ for Expo SDK 57). https://nodejs.org" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required (ships with Node.js)." >&2
  exit 1
fi

sdk=""
for candidate in \
  "${ANDROID_HOME:-}" \
  "${ANDROID_SDK_ROOT:-}" \
  "${LOCALAPPDATA:-}/Android/Sdk" \
  "${HOME}/AppData/Local/Android/Sdk" \
  "${HOME}/Library/Android/sdk" \
  "${HOME}/Android/Sdk"
do
  if [[ -n "$candidate" && -d "$candidate" ]]; then
    if [[ -x "$candidate/platform-tools/adb" || -x "$candidate/emulator/emulator" || -x "$candidate/emulator/emulator.exe" ]]; then
      sdk="$candidate"
      break
    fi
  fi
done

if [[ -z "$sdk" ]]; then
  echo "Android SDK not found." >&2
  echo >&2
  echo "Install Android Studio, then set ANDROID_HOME (or ANDROID_SDK_ROOT)." >&2
  echo "Typical: macOS ~/Library/Android/sdk  Linux ~/Android/Sdk  Windows %LOCALAPPDATA%\\\\Android\\\\Sdk" >&2
  exit 1
fi

ADB="$sdk/platform-tools/adb"
EMULATOR="$sdk/emulator/emulator"
if [[ ! -x "$ADB" && -x "${ADB}.exe" ]]; then ADB="${ADB}.exe"; fi
if [[ ! -x "$EMULATOR" && -x "${EMULATOR}.exe" ]]; then EMULATOR="${EMULATOR}.exe"; fi

if [[ ! -x "$ADB" ]]; then
  echo "adb not found at $ADB. Install Android SDK Platform-Tools." >&2
  exit 1
fi
if [[ ! -x "$EMULATOR" ]]; then
  echo "emulator not found at $EMULATOR. Install Android Emulator in SDK Manager." >&2
  exit 1
fi

export ANDROID_HOME="$sdk"
export ANDROID_SDK_ROOT="$sdk"
# SDK platform-tools first so a stray adb on PATH cannot win.
export PATH="$sdk/platform-tools:$sdk/emulator:$PATH"

echo "Android SDK: $sdk"
echo "Using SDK adb: $ADB"

"$ADB" start-server >/dev/null 2>&1 || true

AVD_NAMES=()
while IFS= read -r line; do
  line="$(printf '%s' "$line" | tr -d '\r')"
  [[ -n "$line" ]] && AVD_NAMES+=("$line")
done < <("$EMULATOR" -list-avds 2>/dev/null)
if [[ ${#AVD_NAMES[@]} -eq 0 ]]; then
  echo "No Android Virtual Devices found." >&2
  echo >&2
  echo "Create one in Android Studio: Device Manager (AVD Manager) -> Create Device" >&2
  echo "(e.g. Pixel 9a, Google Play system image, API 34+). Then re-run." >&2
  exit 1
fi

echo "Available AVDs:"
for name in "${AVD_NAMES[@]}"; do
  echo "  $name"
done
echo

preferred_avd() {
  # Purpose: Pixel_9a if listed, else first name (list-avds is alphabetical).
  local n
  for n in "${AVD_NAMES[@]}"; do
    if [[ "$n" == "Pixel_9a" ]]; then
      printf '%s' "$n"
      return 0
    fi
  done
  printf '%s' "${AVD_NAMES[0]}"
}

ready_serial() {
  # Purpose: first emulator serial in state `device` (not offline).
  "$ADB" devices | awk '/^emulator-[0-9]+[[:space:]]+device$/ { print $1; exit }'
}

any_adb_emulator() {
  # Purpose: first emulator-* serial in adb, any state (offline still counts as listed).
  "$ADB" devices | awk '/^emulator-[0-9]+[[:space:]]/ { print $1; exit }'
}

emulator_vm_alive() {
  # Purpose: true if qemu-system-* or the emulator binary is running.
  # Design: on Windows the emulator process is a launcher and often exits;
  # qemu-system-x86_64 is the VM. Parent PID death is not failure.
  if command -v pgrep >/dev/null 2>&1; then
    pgrep -f 'qemu-system-' >/dev/null 2>&1 && return 0
    pgrep -x 'emulator' >/dev/null 2>&1 && return 0
    pgrep -f 'emulator.exe' >/dev/null 2>&1 && return 0
  fi
  return 1
}

emulator_is_live() {
  # Purpose: true if qemu/emulator is running or adb lists emulator-*.
  emulator_vm_alive && return 0
  [[ -n "$(any_adb_emulator || true)" ]] && return 0
  return 1
}

wait_for_spawn() {
  # Purpose: wait up to ~20s for qemu, emulator, or adb emulator-* after launch.
  # Inputs: timeout seconds. Outputs: 0 if live, 1 if not.
  # Design: do not treat the emulator launcher PID exiting as death.
  local timeout_sec="${1:-20}"
  echo "Waiting up to ${timeout_sec}s for QEMU or adb emulator-*." >&2
  local started=$SECONDS
  while (( SECONDS - started < timeout_sec )); do
    if emulator_is_live; then
      return 0
    fi
    sleep 1
  done
  if emulator_is_live; then
    return 0
  fi
  return 1
}

tail_emu_log() {
  # Purpose: print last lines of a log if one exists; otherwise point at the console.
  local log_path="$1"
  if [[ -n "$log_path" && -f "$log_path" ]]; then
    echo "Last 30 lines of $log_path:" >&2
    tail -n 30 "$log_path" >&2 || true
  else
    echo "No captured emulator log (QEMU/UWB print in the emulator console, not this terminal)." >&2
    if [[ -n "$log_path" ]]; then
      echo "Looked for $log_path" >&2
    fi
  fi
}

print_wait_hint() {
  # Purpose: next steps after a failed spawn or boot wait. ASCII only.
  # Inputs: log path, AVD name, GPU mode.
  # Design: do not suggest Pixel_9a as a "faster AVD" if that is already the target.
  local log_path="$1"
  local avd_name="$2"
  local gpu_mode="$3"
  if [[ -n "$log_path" ]]; then
    echo "Log path (often unused): $log_path" >&2
  fi
  echo "QEMU/UWB output is in the emulator console window, not this terminal." >&2
  if [[ "$gpu_mode" == "swiftshader_indirect" ]]; then
    echo "Swiftshader is slower and can fail to spawn. Try without --gpu first (default auto):" >&2
    echo "  ./scripts/start-emulator.sh --avd ${avd_name}" >&2
  else
    echo "If the emulator window stays black, try software GPU:" >&2
    echo "  ./scripts/start-emulator.sh --avd ${avd_name} --gpu swiftshader_indirect" >&2
  fi
  if [[ "$avd_name" == "Pixel_9a" ]]; then
    echo "To try another AVD: ./scripts/start-emulator.sh --avd Medium_Phone_API_36.1" >&2
  else
    echo "To try Pixel_9a: ./scripts/start-emulator.sh --avd Pixel_9a" >&2
  fi
  echo "If the emulator window never appeared, open Android Studio Device Manager." >&2
}

wait_for_boot() {
  # Purpose: poll every 3s until serial is device and sys.boot_completed=1.
  # Inputs: timeout seconds, log path, AVD name, GPU mode.
  # Design: no adb wait-for-device (no progress; too short for swiftshader).
  # Parent emulator PID exit is not failure while qemu or adb emulator-* is up.
  local timeout_sec="$1"
  local log_path="$2"
  local avd_name="$3"
  local gpu_mode="$4"
  echo "Waiting for emulator to boot (up to ${timeout_sec}s)..." >&2
  local started=$SECONDS
  local serial=""
  while (( SECONDS - started < timeout_sec )); do
    local elapsed=$((SECONDS - started))
    echo "  still waiting (${elapsed}s)..." >&2
    if ! emulator_is_live; then
      echo "Emulator is gone (no QEMU, no adb emulator-*) before boot completed." >&2
      tail_emu_log "$log_path"
      print_wait_hint "$log_path" "$avd_name" "$gpu_mode"
      exit 1
    fi
    serial="$(ready_serial || true)"
    if [[ -n "$serial" ]]; then
      local boot
      boot="$("$ADB" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
      if [[ "$boot" == "1" ]]; then
        sleep 2
        echo "$serial"
        return 0
      fi
    fi
    sleep 3
  done
  echo "Emulator did not become ready within ${timeout_sec}s (need device + sys.boot_completed=1)." >&2
  tail_emu_log "$log_path"
  print_wait_hint "$log_path" "$avd_name" "$gpu_mode"
  exit 1
}

EMU_LOG="${TEMP:-${TMPDIR:-/tmp}}/halo-emulator.log"
timeout_sec=180
if [[ "$GPU" == "swiftshader_indirect" ]]; then
  timeout_sec=300
fi

if [[ -n "$AVD" ]]; then
  hint_avd="$AVD"
else
  hint_avd="$(preferred_avd)"
fi

listed="$(any_adb_emulator || true)"
serial="$(ready_serial || true)"
if [[ -n "$serial" ]]; then
  echo "Using already-running emulator: $serial"
elif [[ -n "$listed" ]] || emulator_vm_alive; then
  if [[ -n "$listed" ]]; then
    echo "Emulator already listed ($listed); waiting for boot..."
  else
    echo "QEMU/emulator already running; waiting for adb..."
  fi
  serial="$(wait_for_boot "$timeout_sec" "$EMU_LOG" "$hint_avd" "$GPU")"
  echo "Emulator ready: $serial"
else
  if [[ -n "$AVD" ]]; then
    target="$AVD"
  else
    target="$(preferred_avd)"
  fi
  found=0
  for name in "${AVD_NAMES[@]}"; do
    if [[ "$name" == "$target" ]]; then found=1; break; fi
  done
  if [[ "$found" -eq 0 ]]; then
    echo "AVD \"$target\" not found. Create it in Android Studio Device Manager." >&2
    exit 1
  fi

  # Packet streamer / netsimd UWB warnings are expected (Halo does not use UWB).
  EMU_ARGS=(-avd "$target" -feature -Uwb -gpu "$GPU" -cores 4 -no-metrics)
  if [[ "$SNAPSHOT" -eq 0 ]]; then
    EMU_ARGS+=(-no-snapshot-load)
  fi
  echo "Starting emulator ${target}... (UWB warnings are harmless)"
  echo "Default GPU is auto. Swiftshader is slower and can fail to spawn; use --gpu swiftshader_indirect only if the window stays black."
  echo "QEMU/UWB messages may print in a separate emulator console (stdout is not captured)."
  if [[ "$target" != "Pixel_9a" ]]; then
    echo "Default AVD is Pixel_9a when present. Override: ./scripts/start-emulator.sh --avd Medium_Phone_API_36.1"
  fi
  "$EMULATOR" "${EMU_ARGS[@]}" &
  disown || true

  if ! wait_for_spawn 20; then
    echo "Emulator did not spawn QEMU or an adb emulator-* within 20s." >&2
    tail_emu_log "$EMU_LOG"
    print_wait_hint "$EMU_LOG" "$target" "$GPU"
    exit 1
  fi
  serial="$(wait_for_boot "$timeout_sec" "$EMU_LOG" "$target" "$GPU")"
  echo "Emulator ready: $serial"
fi

export ANDROID_SERIAL="$serial"

if [[ ! -d node_modules ]]; then
  echo "Installing npm dependencies..."
  npm install
fi

if [[ "$LOCAL_DEBUG" -eq 1 ]]; then
  if [[ -z "${JAVA_HOME:-}" ]]; then
    echo "JAVA_HOME is not set. Gradle needs JDK 17 if the native build fails." >&2
  fi
  echo "Local debug: expo run:android (native debug APK on this emulator, not Expo Go)."
  echo
  if [[ "$CLEAR" -eq 1 ]]; then
    npx --yes expo run:android --device "$serial" --no-build-cache
  else
    npx --yes expo run:android --device "$serial"
  fi
  "$ADB" -s "$serial" shell am start -n 'com.halo.journal/.MainActivity' >/dev/null 2>&1 || true
  exit 0
fi

echo "Starting Expo against the emulator (Expo Go). First run may install Expo Go on the AVD."
echo
if [[ "$CLEAR" -eq 1 ]]; then
  npx --yes expo start --clear --android
else
  npx --yes expo start --android
fi
