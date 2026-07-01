#!/usr/bin/env bash
#
# Minimal alerting: scrape the loopback metrics endpoint, evaluate the
# "address it now" conditions, and email if any fire. Run by a systemd timer
# every minute (see provision.sh). No Prometheus, no extra daemon.
#
# Two kinds of check:
#   - Stateless gauges that describe the box right now (disk, janitor heartbeat,
#     stuck send queue, inflight saturation). One scrape is enough.
#   - Windowed rates and the GET /a p99 latency, which need a before/after. We
#     keep the previous scrape's cumulative counters in a small state file and
#     diff against this scrape, so the check covers the rate-based rules in
#     alerts.example.yml without a real scraper. The window is the gap between
#     runs (~1 min). A full Prometheus over the same /metrics is still the path
#     for longer-window smoothing and history; this stays simple on purpose.
#
# Latency is read from the histogram buckets, whose boundaries are exactly the
# alert thresholds (0.025 and 0.1 s). "p99 > T" is the same statement as "more
# than 1% of the windowed reads were slower than T", which is a bucket fraction,
# so no quantile interpolation is needed. It is gated on a minimum window sample
# count so a couple of slow reads on an idle box never page.
#
# Email needs an outbound mail command on the box. By default it pipes the
# message to `msmtp -t`; install one (msmtp with a Gmail app password) or point
# STI_ALERT_SENDER at any command that reads an RFC822 message on stdin. With no
# sender configured it logs to the journal so the check is never silently lost.
set -euo pipefail

METRICS_URL="${STI_METRICS_URL:-http://127.0.0.1:9090/metrics}"
# Recipient is operator-provided (set STI_ALERT_EMAIL on the box; provision.sh
# sets it to the alerts@sti.care alias, which Cloudflare forwards to the owner
# inbox). No address is baked into the repo; unset means the alert is logged to
# the journal instead of emailed, so a missing recipient is never silent.
EMAIL="${STI_ALERT_EMAIL:-}"
# From MUST be the address the sender authenticates as (the Gmail account msmtp
# logs in with). sti.care is _dmarc p=reject, so a From in the sti.care domain
# relayed through Gmail fails alignment and is rejected: there is no safe default.
# It is therefore required, kept on the box (never in the repo, it is personal),
# and the delivery step fails safe (logs, never sends a guaranteed bounce) when
# it is unset.
FROM="${STI_ALERT_FROM:-}"
SENDER="${STI_ALERT_SENDER:-msmtp -t}"
STATE="${STI_ALERT_STATE:-/var/lib/stiapi/alert-state}"
HOST="$(hostname)"

# Thresholds (kept in step with alerts.example.yml).
DISK_MIN_BYTES="${STI_ALERT_DISK_MIN:-2000000000}" # 2 GB
JANITOR_STALE_SEC="${STI_ALERT_JANITOR_STALE:-300}"
QUEUE_AGE_SEC="${STI_ALERT_QUEUE_AGE:-600}"
INFLIGHT_WARN_RATIO="${STI_ALERT_INFLIGHT_WARN:-0.80}"
INFLIGHT_PAGE_RATIO="${STI_ALERT_INFLIGHT_PAGE:-0.95}"
# These must match histogram bucket boundaries (durationBuckets in metrics.go):
# the p99 check reads the le=THRESHOLD bucket directly, so a non-boundary value
# would select no series.
P99_WARN_SEC="${STI_ALERT_P99_WARN:-0.025}"
P99_PAGE_SEC="${STI_ALERT_P99_PAGE:-0.1}"
# Don't judge p99 until the window has enough reads to make 1% meaningful.
P99_MIN_SAMPLES="${STI_ALERT_P99_MIN_SAMPLES:-100}"
# A window older than this is treated as missing (skip the rate/latency checks
# rather than diff across a long gap).
WINDOW_MAX_SEC="${STI_ALERT_WINDOW_MAX:-300}"

metrics="$(curl -fsS --max-time 5 "$METRICS_URL" 2>/dev/null || true)"
if [ -z "$metrics" ]; then
	echo "stiapi-alert: metrics endpoint unreachable at $METRICS_URL" >&2
	exit 0
fi

# val SELECTOR -> the value of the single series line "SELECTOR <value>", or
# empty. SELECTOR is the full "name" or "name{labels}" token (labels are rendered
# sorted and space-free, so an exact field match is safe).
val() { awk -v n="$1" '$1==n{print $2; exit}' <<<"$metrics"; }

# sum_metric NAME -> sum of every series of NAME across its label sets (labeled
# "NAME{...}" or the bare "NAME"). The "{" anchor stops a name from matching a
# longer one (e.g. sti_request_duration_seconds_bucket).
sum_metric() {
	awk -v n="$1" 'index($1, n"{")==1 || $1==n {s+=$2} END{printf "%d", s+0}' <<<"$metrics"
}

now="$(date +%s)"
warns=()
pages=()

# --- stateless gauge checks -------------------------------------------------

disk="$(val sti_disk_free_bytes)"
if [ -n "$disk" ] && [ "$disk" -lt "$DISK_MIN_BYTES" ]; then
	pages+=("disk free ${disk} bytes is below ${DISK_MIN_BYTES}")
fi

janitor="$(val sti_janitor_last_run_seconds)"
if [ -n "$janitor" ] && [ "$janitor" -gt 0 ]; then
	age=$((now - janitor))
	if [ "$age" -gt "$JANITOR_STALE_SEC" ]; then
		pages+=("background janitor last ran ${age}s ago (stalled)")
	fi
fi

qage="$(val sti_send_queue_oldest_age_seconds)"
if [ -n "$qage" ] && [ "$qage" -gt "$QUEUE_AGE_SEC" ]; then
	warns+=("oldest queued send is ${qage}s old (drain may be stuck)")
fi

cur="$(val sti_inflight_current)"
max="$(val sti_inflight_max)"
if [ -n "$cur" ] && [ -n "$max" ] && [ "$max" -gt 0 ]; then
	tier="$(awk -v c="$cur" -v m="$max" -v w="$INFLIGHT_WARN_RATIO" -v p="$INFLIGHT_PAGE_RATIO" \
		'BEGIN{r=c/m; print (r>p) ? "page" : (r>w) ? "warn" : "ok"}')"
	case "$tier" in
	page) pages+=("in-flight ${cur}/${max} is above ${INFLIGHT_PAGE_RATIO} of the cap") ;;
	warn) warns+=("in-flight ${cur}/${max} is above ${INFLIGHT_WARN_RATIO} of the cap") ;;
	esac
fi

# --- windowed rate + latency checks (need the previous scrape) ---------------

# Cumulative counters this scrape. Shed/ratelimit/sensitive/errors are summed
# across their label sets; the /a latency buckets are exact series.
c_shed="$(sum_metric sti_shed_total)"
c_ratelimit="$(sum_metric sti_ratelimit_rejections_total)"
c_sensitive="$(sum_metric sti_sensitive_overload_total)"
c_errors="$(sum_metric sti_errors_total)"
# "Something wrong?" reports filed (doc 34): a monotonic counter we diff to nudge
# the operator about new reports. Absent on an old binary, so it defaults to 0.
c_feedback="$(val sti_feedback_received_total)"
c_a_count="$(val 'sti_request_duration_seconds_count{endpoint="/a/{id}"}')"
c_a_le_warn="$(val "sti_request_duration_seconds_bucket{endpoint=\"/a/{id}\",le=\"${P99_WARN_SEC}\"}")"
c_a_le_page="$(val "sti_request_duration_seconds_bucket{endpoint=\"/a/{id}\",le=\"${P99_PAGE_SEC}\"}")"
: "${c_feedback:=0}" "${c_a_count:=0}" "${c_a_le_warn:=0}" "${c_a_le_page:=0}"

prev_ts=""
p_shed=0 p_ratelimit=0 p_sensitive=0 p_errors=0 p_a_count=0 p_a_le_warn=0 p_a_le_page=0
p_feedback=0
if [ -f "$STATE" ]; then
	while IFS='=' read -r k v; do
		case "$k" in
		ts) prev_ts="$v" ;;
		shed) p_shed="$v" ;;
		ratelimit) p_ratelimit="$v" ;;
		sensitive) p_sensitive="$v" ;;
		errors) p_errors="$v" ;;
		feedback) p_feedback="$v" ;;
		a_count) p_a_count="$v" ;;
		a_le_warn) p_a_le_warn="$v" ;;
		a_le_page) p_a_le_page="$v" ;;
		esac
	done <"$STATE"
fi

# Persist this scrape for the next run (atomic, before evaluating, so a later
# failure can't lose the baseline).
tmp="$(mktemp "${STATE}.XXXXXX")"
cat >"$tmp" <<EOF
ts=$now
shed=$c_shed
ratelimit=$c_ratelimit
sensitive=$c_sensitive
errors=$c_errors
feedback=$c_feedback
a_count=$c_a_count
a_le_warn=$c_a_le_warn
a_le_page=$c_a_le_page
EOF
mv -f "$tmp" "$STATE"

# New "Something wrong?" reports since the last scrape (doc 34): a bare-nudge signal,
# independent of the ops-alert window below. A counter that went backwards (a restart
# with a lost snapshot) yields no nudge, the same reset guard the rate checks use.
new_reports=0
if [ -n "$prev_ts" ] && [ "$c_feedback" -gt "$p_feedback" ]; then
	new_reports=$((c_feedback - p_feedback))
fi

window_ok=0
if [ -n "$prev_ts" ]; then
	dt=$((now - prev_ts))
	# Usable window, and no counter went backwards (a restart with a wiped
	# counts file, or a clock jump, would make a diff meaningless).
	if [ "$dt" -gt 0 ] && [ "$dt" -le "$WINDOW_MAX_SEC" ] &&
		[ "$c_shed" -ge "$p_shed" ] && [ "$c_ratelimit" -ge "$p_ratelimit" ] &&
		[ "$c_sensitive" -ge "$p_sensitive" ] && [ "$c_errors" -ge "$p_errors" ] &&
		[ "$c_a_count" -ge "$p_a_count" ]; then
		window_ok=1
	fi
fi

if [ "$window_ok" = 1 ]; then
	d_shed=$((c_shed - p_shed))
	d_ratelimit=$((c_ratelimit - p_ratelimit))
	d_sensitive=$((c_sensitive - p_sensitive))
	d_errors=$((c_errors - p_errors))
	d_visible_shed=$((d_shed + d_ratelimit))
	d_a_count=$((c_a_count - p_a_count))
	d_a_le_warn=$((c_a_le_warn - p_a_le_warn))
	d_a_le_page=$((c_a_le_page - p_a_le_page))

	if [ "$d_visible_shed" -gt 0 ]; then
		warns+=("visible shed: ${d_shed} x 503 + ${d_ratelimit} x 429 in the last ${dt}s (callers turned away)")
	fi
	if [ "$d_sensitive" -gt 0 ]; then
		warns+=("sensitive reads hit the uniform-overload fallback ${d_sensitive}x in the last ${dt}s (hidden saturation)")
	fi
	if [ "$d_errors" -gt 0 ]; then
		warns+=("${d_errors} internal error(s) in the last ${dt}s (see errors_total by type)")
	fi

	# GET /a p99 from bucket fractions. p99 > T iff >1% of the window's reads
	# were slower than T iff fewer than 99% landed at or below the le=T bucket.
	if [ "$d_a_count" -ge "$P99_MIN_SAMPLES" ]; then
		tier="$(awk -v n="$d_a_count" -v lw="$d_a_le_warn" -v lp="$d_a_le_page" \
			'BEGIN{ if (lp/n < 0.99) print "page"; else if (lw/n < 0.99) print "warn"; else print "ok" }')"
		case "$tier" in
		page) pages+=("GET /a p99 above ${P99_PAGE_SEC}s over the last ${dt}s (${d_a_count} reads, $((d_a_count - d_a_le_page)) slower than ${P99_PAGE_SEC}s)") ;;
		warn) warns+=("GET /a p99 above ${P99_WARN_SEC}s over the last ${dt}s (${d_a_count} reads, $((d_a_count - d_a_le_warn)) slower than ${P99_WARN_SEC}s)") ;;
		esac
	fi
fi

# --- deliver ----------------------------------------------------------------

# deliver SUBJECT SEV BODY -> email the message via $SENDER, or on a missing
# recipient / sender / From log the reason PLUS the body to the journal, so a missing
# prerequisite is a fail-safe (never a guaranteed bounce, never a lost signal). Both
# the ops alert and the "new report(s)" nudge (doc 34) go through this one path.
deliver() {
	local subject="$1" sev="$2" body="$3"
	if [ -z "$EMAIL" ]; then
		printf 'stiapi-alert: STI_ALERT_EMAIL unset (no recipient):\n%s\n' "$body" >&2
		return 0
	fi
	if ! command -v "${SENDER%% *}" >/dev/null 2>&1; then
		printf 'stiapi-alert: no sender (%s):\n%s\n' "${SENDER%% *}" "$body" >&2
		return 0
	fi
	if [ -z "$FROM" ]; then
		printf "stiapi-alert: STI_ALERT_FROM unset (set it to the sender's authenticated address; sti.care is DMARC p=reject so an unaligned From would bounce):\n%s\n" "$body" >&2
		return 0
	fi
	# A real Date and Message-ID plus the auto-message markers (MIME, Auto-Submitted,
	# Precedence) so the forward is accepted by spam filters and never triggers an
	# auto-reply loop. Date uses an explicit +0000 (portable across BSD/GNU date).
	local msgid message
	msgid="<$(date +%s).$$.${RANDOM}@$(hostname -f 2>/dev/null || echo "$HOST")>"
	message="To: ${EMAIL}
From: ${FROM}
Subject: ${subject}
Date: $(date -u '+%a, %d %b %Y %H:%M:%S +0000')
Message-ID: ${msgid}
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8
Auto-Submitted: auto-generated
Precedence: bulk

${body}"
	printf '%s\n' "$message" | $SENDER
	echo "stiapi-alert: sent (${sev}) to ${EMAIL}" >&2
}

total=$(( ${#warns[@]} + ${#pages[@]} ))
if [ "$total" -eq 0 ] && [ "$new_reports" -eq 0 ]; then
	exit 0
fi

# The operational alert: the "address it now" conditions in one page-or-warn email.
if [ "$total" -gt 0 ]; then
	body="sti.care alert on ${HOST} at $(date -u '+%Y-%m-%d %H:%M:%SZ')"$'\n\n'
	for a in "${pages[@]:-}"; do [ -n "$a" ] && body+="- [page] ${a}"$'\n'; done
	for a in "${warns[@]:-}"; do [ -n "$a" ] && body+="- [warn] ${a}"$'\n'; done
	sev="warn"
	[ "${#pages[@]}" -gt 0 ] && sev="PAGE"
	deliver "[sti.care][${sev}] ${total} alert(s) on ${HOST}" "$sev" "$body"
fi

# The "Something wrong?" nudge (doc 34): a SEPARATE, bare message so the ops alert
# stays page/warn-only. Only the count leaves the box, never a category or note.
if [ "$new_reports" -gt 0 ]; then
	deliver "[sti.care] ${new_reports} new report(s) waiting" "info" \
		"${new_reports} new report(s) came in. Open https://sti.care/admin to review."
fi
