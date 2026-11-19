#!/usr/bin/env bash
set -euo pipefail

PORT=8791
TMP_DIR="${RUNNER_TEMP:-/tmp}"
LOG_FILE="$TMP_DIR/doot-worker-streaming.log"
HEADERS_FILE="$TMP_DIR/doot-worker-streaming.headers"
BODY_FILE="$TMP_DIR/doot-worker-streaming.body"

npx --yes wrangler@4.162.0 dev --local \
  --config wrangler.stream-test.json \
  --ip 127.0.0.1 --port "$PORT" --log-level error >"$LOG_FILE" 2>&1 &
WORKER_PID=$!
cleanup() {
  kill "$WORKER_PID" 2>/dev/null || true
  wait "$WORKER_PID" 2>/dev/null || true
}
trap cleanup EXIT

READY=0
for _ in $(seq 1 45); do
  if curl --silent --show-error --fail \
    -D "$HEADERS_FILE" -o "$BODY_FILE" \
    "http://127.0.0.1:$PORT/"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  cat "$LOG_FILE"
  echo "Local workerd Worker did not become ready."
  exit 1
fi

if ! grep -qi '^content-type: text/event-stream' "$HEADERS_FILE"; then
  cat "$HEADERS_FILE"
  cat "$BODY_FILE"
  cat "$LOG_FILE"
  echo "Worker response was not an event stream."
  exit 1
fi

if ! grep -q 'Worker runtime stream OK' "$BODY_FILE"; then
  cat "$BODY_FILE"
  cat "$LOG_FILE"
  echo "Worker stream did not deliver the expected text delta."
  exit 1
fi

echo "Local workerd streaming smoke test passed."
