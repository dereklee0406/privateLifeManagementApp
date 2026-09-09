#!/usr/bin/env bash
# Start Halo Expo/Metro on http://localhost:8081 (server only, no AVD).
#
# Purpose: run the Expo bundler so a browser, Expo Go, or an already-running
#          emulator can connect. Does not boot an Android emulator.
# Inputs:  --clear / -c       Metro cache (expo start --clear)
#          --web              Open the web preview (--web)
#          --tunnel           Expo tunnel instead of LAN
#          --localhost-only   Bind loopback only (--localhost). Breaks phones.
#          --force            If 8081 is in use, stop that listener then start.
# Outputs: Metro bundler in this terminal. URL: http://localhost:8081
# Side effects: may npm install; may kill 8081 listeners when --force.
# Design: default host is LAN so localhost AND the LAN IP work.
#         npm run emu boots an AVD and runs expo start --android.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

METRO_PORT=8081
METRO_URL="http://localhost:${METRO_PORT}"

CLEAR=0
WEB=0
TUNNEL=0
LOCALHOST_ONLY=0
FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --clear|-Clear|-c)
      CLEAR=1
      shift
      ;;
    --web|-Web)
      WEB=1
      shift
      ;;
    --tunnel|-Tunnel)
      TUNNEL=1
      shift
      ;;
    --localhost-only|-LocalhostOnly)
      LOCALHOST_ONLY=1
      shift
      ;;
    --force|-Force)
      FORCE=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: ./scripts/start-metro.sh [--clear] [--web] [--tunnel] [--localhost-only] [--force]" >&2
      exit 1
      ;;
  esac
done

echo "Halo Metro - $APP_ROOT (port $METRO_PORT)"
echo

fail() {
  # Purpose: print an error and exit 1.
  # Inputs: message. Outputs: stderr. Side effects: process exit.
  echo "$1" >&2
  exit 1
}

join_pids() {
  # Purpose: turn newline-separated PIDs into a comma list for messages.
  # Inputs: PID lines on stdin. Outputs: "123,456". Side effects: none.
  tr '\n' ',' | sed 's/,$//'
}

get_tcp_listen_pids() {
  # Purpose: PIDs LISTENING on a TCP port.
  # Inputs: port number. Outputs: unique PIDs, one per line (empty if none).
  # Side effects: none.
  # Design: prefer lsof (macOS); fall back to ss (Linux). If neither exists,
  # Expo will fail on bind instead of a preflight message.
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  elif command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' || true)"
  fi
  if [[ -z "${pids}" ]]; then
    return 0
  fi
  printf '%s\n' $pids | awk 'NF && $1+0 > 0 { print $1+0 }' | sort -u
}

show_port_busy_help() {
  # Purpose: tell the user Metro (or something else) already owns 8081.
  # Inputs: PID list string. Outputs: stdout. Side effects: none.
  local pid_list="$1"
  echo "Metro already on ${METRO_PORT}"
  echo "Open: ${METRO_URL}"
  echo "Expo Go on a physical phone needs the LAN IP shown in that Metro terminal, not localhost."
  echo "Listener PID: ${pid_list}"
  echo "To inspect: lsof -nP -iTCP:${METRO_PORT} -sTCP:LISTEN"
  echo "Or: netstat -an | grep ${METRO_PORT}"
  echo "Re-run with --force to stop that process and start a new server."
}

if [[ "$TUNNEL" -eq 1 && "$LOCALHOST_ONLY" -eq 1 ]]; then
  fail "Use either --tunnel or --localhost-only, not both."
fi

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is required (20.18+ for Expo SDK 57). https://nodejs.org"
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${node_major}" -lt 20 ]]; then
  echo "Warning: Node ${node_major} detected; Expo SDK 57 expects Node 20+. Continuing anyway."
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required (ships with Node.js)."
fi

if [[ ! -d node_modules ]]; then
  echo "Installing npm dependencies..."
  npm install
fi

busy_pids="$(get_tcp_listen_pids "$METRO_PORT" || true)"
if [[ -n "${busy_pids}" ]]; then
  pid_csv="$(printf '%s\n' "$busy_pids" | join_pids)"
  if [[ "$FORCE" -eq 0 ]]; then
    show_port_busy_help "$pid_csv"
    exit 1
  fi
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    if [[ "$pid" -le 4 ]]; then
      fail "Refusing to kill system PID ${pid} on port ${METRO_PORT}. Stop it yourself, then re-run."
    fi
    echo "Stopping PID ${pid} on port ${METRO_PORT}..."
    kill "$pid"
  done <<< "$busy_pids"
  sleep 1
  still="$(get_tcp_listen_pids "$METRO_PORT" || true)"
  if [[ -n "${still}" ]]; then
    fail "Port ${METRO_PORT} still in use after --force (PID $(printf '%s\n' "$still" | join_pids)). Close it, then re-run."
  fi
fi

expo_args=(--yes expo start --port "$METRO_PORT")
if [[ "$LOCALHOST_ONLY" -eq 1 ]]; then
  expo_args+=(--localhost)
  host_msg="Host: localhost only (physical devices cannot connect)."
elif [[ "$TUNNEL" -eq 1 ]]; then
  expo_args+=(--tunnel)
  host_msg="Host: tunnel (Expo prints a public URL)."
else
  expo_args+=(--lan)
  host_msg="Host: LAN (localhost and your LAN IP both work)."
fi
if [[ "$CLEAR" -eq 1 ]]; then
  expo_args+=(--clear)
fi
if [[ "$WEB" -eq 1 ]]; then
  expo_args+=(--web)
fi

echo "Starting Expo/Metro on ${METRO_URL}"
echo "$host_msg"
echo "This script does not start an emulator. For an AVD: npm run emu"
echo "Then open Expo Go, press a/w in this terminal, or use the URL above."
echo

npx "${expo_args[@]}"
