#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

port="${LIVE_SERVER_PORT:-7406}"
log=/tmp/inlign-liveserver.log
pidfile=/tmp/inlign-liveserver.pid

if [ -f "$pidfile" ]; then
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    echo "live server already running (pid $pid); stop it with: kill $pid" >&2
    exit 1
  fi
fi

nohup node scripts/env.mjs vite --host 0.0.0.0 --port "$port" --strictPort > "$log" 2>&1 &
pid=$!
echo "$pid" > "$pidfile"
echo "live server on http://0.0.0.0:$port (pid $pid, log $log)"
