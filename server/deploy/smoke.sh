#!/usr/bin/env bash
#
# End-to-end smoke test against a running deployment. Exits non-zero on any
# failure, so it doubles as a deploy-time healthcheck.
#
#   server/deploy/smoke.sh [--read-only] [base_url]   # default https://api.sti.care
#
# --read-only runs only non-writing checks (health + an existence-uniform read),
# so it is safe against production as a post-deploy healthcheck without leaving
# rows behind. The full write cycle runs in CI against a local instance.
#
set -euo pipefail
READONLY=0
if [ "${1:-}" = "--read-only" ]; then
	READONLY=1
	shift
fi
BASE="${1:-https://api.sti.care}"
SIZE=4096
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

id() { openssl rand -base64 32 | tr '+/' '-_' | tr -d '='; }
fail() {
	echo "SMOKE FAIL: $1" >&2
	exit 1
}

echo "smoke: $BASE (read-only=$READONLY)"

# Health (read-only).
[ "$(curl -fsS "$BASE/healthz")" = '{"status":"ok"}' ] || fail "healthz"

# A missing alias is existence-uniform: same 200, same length (read-only).
MISS="$(id)"
mcode="$(curl -s -o "$tmp/miss" -w '%{http_code}' "$BASE/a/$MISS")"
[ "$mcode" = 200 ] || fail "miss status $mcode"
[ "$(wc -c <"$tmp/miss")" -eq "$SIZE" ] || fail "miss length not $SIZE"

if [ "$READONLY" = 1 ]; then
	echo "SMOKE OK (read-only)"
	exit 0
fi

# --- write-cycle checks (skipped in read-only) ---

# Alias round-trip.
ALIAS="$(id)"
head -c "$SIZE" /dev/urandom >"$tmp/payload"
code="$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'X-Write-Token: smoke' --data-binary @"$tmp/payload" "$BASE/a/$ALIAS")"
[ "$code" = 204 ] || fail "alias PUT -> $code"
curl -fsS "$BASE/a/$ALIAS" -o "$tmp/got"
cmp -s "$tmp/payload" "$tmp/got" || fail "alias round-trip bytes differ"

# A viewer (wrong write token) cannot overwrite.
ecode="$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'X-Write-Token: wrong' --data-binary @"$tmp/payload" "$BASE/a/$ALIAS")"
[ "$ecode" = 403 ] || fail "non-owner overwrite got $ecode, want 403"

# Account sync round-trip + version bump.
ACCT="$(id)"
v1="$(curl -s -D - -o /dev/null -X PUT --data 'blob1' "$BASE/acct/$ACCT" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-version"{print $2}')"
[ "$v1" = 1 ] || fail "acct version1 = $v1"
curl -s -X PUT --data 'blob2' "$BASE/acct/$ACCT" >/dev/null
[ "$(curl -fsS "$BASE/acct/$ACCT")" = blob2 ] || fail "acct read-back"

# Knock is uniform for any id.
[ "$(curl -fsS -X POST -H 'content-type: application/json' -d '{"requesterHash":"r"}' "$BASE/knock/$MISS")" = '{"status":"received"}' ] || fail "knock"

echo "SMOKE OK"
