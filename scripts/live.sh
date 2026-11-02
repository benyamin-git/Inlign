#!/usr/bin/env bash
# Start the current Inlign UI as a detached Vite dev server.
set -euo pipefail

PORT="${LIVE_SERVER_PORT:-7406}"
HOST="0.0.0.0"
LOG="/tmp/inlign-liveserver.log"
PIDFILE="/tmp/inlign-liveserver.pid"

cd "$(dirname "$0")/.."

if ss -H -ltn "sport = :$PORT" | grep -q .; then
  echo "Port $PORT is already in use. Stop that process or set LIVE_SERVER_PORT." >&2
  exit 1
fi

pnpm build:wasm

VITE_BIN="$(
  cd apps/web
  node -p "require('node:path').resolve(require('node:path').dirname(require.resolve('vite')), '../../bin/vite.js')"
)"
cd apps/web

nohup node "$VITE_BIN" --host "$HOST" --port "$PORT" --strictPort >"$LOG" 2>&1 &
PID=$!
echo "$PID" >"$PIDFILE"

echo "Live server: http://localhost:$PORT (LAN: http://<host>:$PORT)"
echo "Log:  $LOG"
echo "Stop: kill \$(cat $PIDFILE)"
