#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3100
BASE_URL="http://127.0.0.1:${PORT}"
COOKIE_JAR="$(mktemp)"
DASHBOARD_FILE="$(mktemp)"
SERVER_LOG="$(mktemp)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$COOKIE_JAR" "$DASHBOARD_FILE" "$SERVER_LOG"
}
trap cleanup EXIT

cd "$PROJECT_DIR"
APP_USERNAME="siteadmin" \
APP_PASSWORD="local-test-password" \
SESSION_SECRET="local-test-session-secret-please-change" \
PORT="$PORT" \
NODE_ENV="test" \
node app.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for attempt in {1..20}; do
  if curl -fsS "$BASE_URL/login" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  cat "$SERVER_LOG"
  exit 1
fi

anonymous_status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/")"
[[ "$anonymous_status" == "302" ]]

login_status="$(curl -sS -o /dev/null -c "$COOKIE_JAR" -b "$COOKIE_JAR" -w '%{http_code}' -X POST \
  --data-urlencode 'username=siteadmin' \
  --data-urlencode 'password=local-test-password' \
  "$BASE_URL/login")"
[[ "$login_status" == "302" ]]

dashboard_status="$(curl -sS -o "$DASHBOARD_FILE" -b "$COOKIE_JAR" -w '%{http_code}' "$BASE_URL/")"
[[ "$dashboard_status" == "200" ]]
grep -q 'Telecom Site Audit' "$DASHBOARD_FILE"
grep -q '4,363 sites imported from your KML file' "$DASHBOARD_FILE"
grep -q 'Enable GPS and find nearest site' "$DASHBOARD_FILE"
csrf_token="$(grep -o 'name="csrfToken" value="[^"]*"' "$DASHBOARD_FILE" | head -n 1 | sed 's/.*value="\([^"]*\)"/\1/')"
[[ -n "$csrf_token" ]]

ticket_status="$(curl -sS -o /dev/null -c "$COOKIE_JAR" -b "$COOKIE_JAR" -w '%{http_code}' -X POST \
  --data-urlencode "csrfToken=$csrf_token" \
  --data-urlencode 'siteId=BAG2694' \
  --data-urlencode 'activity=Power' \
  --data-urlencode 'notes=Local integration test ticket' \
  "$BASE_URL/raise-ticket")"
[[ "$ticket_status" == "302" ]]

curl -sS -o "$DASHBOARD_FILE" -b "$COOKIE_JAR" "$BASE_URL/"
grep -q 'Local integration test ticket' "$DASHBOARD_FILE"
grep -q 'BAG2694' "$DASHBOARD_FILE"

logout_status="$(curl -sS -o /dev/null -c "$COOKIE_JAR" -b "$COOKIE_JAR" -w '%{http_code}' -X POST \
  --data-urlencode "csrfToken=$csrf_token" \
  "$BASE_URL/logout")"
[[ "$logout_status" == "302" ]]

echo 'Local integration test passed: access control, site directory, GPS interface, ticket submission, and logout.'
