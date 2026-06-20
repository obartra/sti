#!/usr/bin/env bash
#
# Tests for alert.sh: feed it synthetic /metrics text (over a file:// URL) and a
# seeded previous-scrape state, run with STI_ALERT_SENDER=cat so the would-be
# email lands on stdout, and assert which alerts fire. Pure bash, no network, no
# box. Run: bash server/deploy/alert_test.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALERT="$SCRIPT_DIR/alert.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

now="$(date +%s)"
fails=0

# A healthy baseline scrape. Helpers below overwrite individual lines per case.
# /a has 10000 reads, essentially all fast (le=0.025 and le=0.1 ~ count).
healthy_metrics() {
	cat <<EOF
sti_disk_free_bytes 50000000000
sti_janitor_last_run_seconds $now
sti_send_queue_oldest_age_seconds 0
sti_inflight_current 3
sti_inflight_max 256
sti_shed_total{endpoint="/acct/{id}"} 0
sti_ratelimit_rejections_total{endpoint="/acct/{id}"} 0
sti_sensitive_overload_total{endpoint="/a/{id}"} 0
sti_sensitive_overload_total{endpoint="/knock/{id}"} 0
sti_errors_total{type="store"} 0
sti_errors_total{type="decode"} 0
sti_errors_total{type="enqueue"} 0
sti_errors_total{type="janitor"} 0
sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.025"} 9999
sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.1"} 10000
sti_request_duration_seconds_count{endpoint="/a/{id}"} 10000
EOF
}

# seed_state writes a previous-scrape state file dt seconds in the past.
# args: dt shed ratelimit sensitive errors a_count a_le_warn a_le_page
seed_state() {
	cat >"$work/state" <<EOF
ts=$((now - $1))
shed=$2
ratelimit=$3
sensitive=$4
errors=$5
a_count=$6
a_le_warn=$7
a_le_page=$8
EOF
}

# run_case NAME METRICS_FILE [FROM] [EMAIL]  -> sets $out (stdout+stderr). FROM
# and EMAIL default to test values (mimicking a provisioned box); pass "" for
# either to exercise the corresponding fail-safe.
run_case() {
	set +e
	out="$(STI_METRICS_URL="file://$2" \
		STI_ALERT_STATE="$work/state" \
		STI_ALERT_SENDER=cat \
		STI_ALERT_FROM="${3-test-from@example.com}" \
		STI_ALERT_EMAIL="${4-alerts@sti.care}" \
		bash "$ALERT" 2>&1)"
	set -e
}

assert_contains() {
	if ! grep -qF -- "$2" <<<"$out"; then
		echo "FAIL: $1: expected to find: $2"
		echo "--- output ---"; echo "$out"; echo "--------------"
		fails=$((fails + 1))
	else
		echo "ok: $1"
	fi
}
assert_absent() {
	if grep -qF -- "$2" <<<"$out"; then
		echo "FAIL: $1: did NOT expect: $2"
		echo "--- output ---"; echo "$out"; echo "--------------"
		fails=$((fails + 1))
	else
		echo "ok: $1"
	fi
}
assert_empty() {
	if [ -n "$out" ]; then
		echo "FAIL: $1: expected no output, got:"; echo "$out"
		fails=$((fails + 1))
	else
		echo "ok: $1"
	fi
}

# Case 1: first run (no prior state), healthy -> nothing fires, state written.
rm -f "$work/state"
healthy_metrics >"$work/m1"
run_case "first-run healthy" "$work/m1"
assert_empty "first run is silent"
if [ -f "$work/state" ]; then echo "ok: state file written on first run"; else echo "FAIL: no state file"; fails=$((fails + 1)); fi

# Case 2: healthy with a prior window -> still silent.
seed_state 60 0 0 0 0 9000 8999 9000
healthy_metrics >"$work/m2"
run_case "healthy windowed" "$work/m2"
assert_empty "healthy window is silent"

# Case 3: p99 PAGE. Window of 1000 /a reads, 20 slower than 100ms (2% > 1%).
seed_state 60 0 0 0 0 9000 8999 9000
{ healthy_metrics | grep -v 'endpoint="/a/{id}"'
  echo 'sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.025"} 9970'
  echo 'sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.1"} 9980'
  echo 'sti_request_duration_seconds_count{endpoint="/a/{id}"} 10000'
} >"$work/m3"
run_case "p99 page" "$work/m3"
assert_contains "p99 page fires" "[page] GET /a p99 above 0.1s"

# Case 4: p99 WARN only. 1000 reads, 15 slower than 25ms but only 5 slower than 100ms.
seed_state 60 0 0 0 0 9000 8999 9000
{ healthy_metrics | grep -v 'endpoint="/a/{id}"'
  echo 'sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.025"} 9985'
  echo 'sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.1"} 9995'
  echo 'sti_request_duration_seconds_count{endpoint="/a/{id}"} 10000'
} >"$work/m4"
run_case "p99 warn" "$work/m4"
assert_contains "p99 warn fires" "[warn] GET /a p99 above 0.025s"
assert_absent "p99 warn does not page" "[page] GET /a p99"

# Case 5: min-sample gate. Only 50 reads in the window, all slow -> no latency alert.
seed_state 60 0 0 0 0 9950 9950 9950
{ healthy_metrics | grep -v 'endpoint="/a/{id}"'
  echo 'sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.025"} 9950'
  echo 'sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.1"} 9950'
  echo 'sti_request_duration_seconds_count{endpoint="/a/{id}"} 10000'
} >"$work/m5"
run_case "min-sample gate" "$work/m5"
assert_absent "small window does not alert on latency" "GET /a p99"

# Case 6: visible shed + sensitive overload + errors deltas -> warns.
seed_state 60 0 0 0 0 9000 8999 9000
{ healthy_metrics | grep -vE 'sti_(shed_total|sensitive_overload_total|errors_total)'
  echo 'sti_shed_total{endpoint="/acct/{id}"} 4'
  echo 'sti_ratelimit_rejections_total{endpoint="/acct/{id}"} 1'
  echo 'sti_sensitive_overload_total{endpoint="/a/{id}"} 2'
  echo 'sti_sensitive_overload_total{endpoint="/knock/{id}"} 0'
  echo 'sti_errors_total{type="store"} 3'
  echo 'sti_errors_total{type="decode"} 0'
  echo 'sti_errors_total{type="enqueue"} 0'
  echo 'sti_errors_total{type="janitor"} 0'
} >"$work/m6"
# prior state had shed/ratelimit/sensitive/errors all 0, so deltas are 4,1,2,3.
run_case "rate deltas" "$work/m6"
assert_contains "visible shed warns" "[warn] visible shed: 4 x 503 + 1 x 429"
assert_contains "sensitive overload warns" "[warn] sensitive reads hit the uniform-overload fallback 2x"
assert_contains "errors warn" "[warn] 3 internal error(s)"

# Case 7: counter-reset guard. Current counters BELOW prior (restart with wiped
# counts) -> window skipped, no false rate/latency alerts.
seed_state 60 100 50 10 10 9000 8999 9000
healthy_metrics >"$work/m7"  # shed=0 etc, below the seeded prior
run_case "reset guard" "$work/m7"
assert_empty "counter reset is silent"

# Case 8: stateless disk-low pages regardless of window.
rm -f "$work/state"
{ healthy_metrics | grep -v sti_disk_free_bytes
  echo 'sti_disk_free_bytes 1000000000'
} >"$work/m8"
run_case "disk low" "$work/m8"
assert_contains "disk low pages" "[page] disk free 1000000000 bytes is below"
# The same delivered message carries the non-PII recipient and the deliverability
# headers.
assert_contains "configured recipient is alerts@sti.care" "To: alerts@sti.care"
assert_contains "from header is the configured sender" "From: test-from@example.com"
assert_contains "message-id header present" "Message-ID: <"
assert_contains "auto-submitted header present" "Auto-Submitted: auto-generated"
assert_absent "no personal address in the message" "@gmail.com"

# Case 9: janitor stalled pages; inflight 85% warns.
rm -f "$work/state"
{ healthy_metrics | grep -vE 'sti_(janitor_last_run_seconds|inflight_current)'
  echo "sti_janitor_last_run_seconds $((now - 600))"
  echo 'sti_inflight_current 218'
} >"$work/m9"
run_case "stateless health" "$work/m9"
assert_contains "janitor stalled pages" "[page] background janitor last ran"
assert_contains "inflight warns" "[warn] in-flight 218/256 is above 0.80"

# Case 10: STI_ALERT_FROM unset -> DMARC fail-safe. The alert is logged, not
# mailed (no message is emitted), so a bouncing From is never sent.
rm -f "$work/state"
{ healthy_metrics | grep -v sti_disk_free_bytes
  echo 'sti_disk_free_bytes 1000000000'
} >"$work/m10"
run_case "from-unset fail-safe" "$work/m10" ""
assert_contains "fail-safe explains the missing From" "STI_ALERT_FROM unset"
assert_contains "fail-safe still surfaces the alert" "disk free 1000000000 bytes is below"
assert_absent "fail-safe emits no message envelope" "To: alerts@sti.care"

# Case 11: STI_ALERT_EMAIL unset -> log only (no recipient), still surfaces it.
rm -f "$work/state"
{ healthy_metrics | grep -v sti_disk_free_bytes
  echo 'sti_disk_free_bytes 1000000000'
} >"$work/m11"
run_case "email-unset fail-safe" "$work/m11" "test-from@example.com" ""
assert_contains "unset recipient logs instead of sending" "STI_ALERT_EMAIL unset"
assert_absent "unset recipient emits no message" "From: test-from@example.com"

echo
if [ "$fails" -eq 0 ]; then
	echo "alert_test: all checks passed"
else
	echo "alert_test: $fails check(s) failed"
	exit 1
fi
