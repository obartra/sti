#!/usr/bin/env bash
#
# Minimal alerting: scrape the loopback metrics endpoint, check the handful of
# "address it now" conditions, and email if any fire. Run by a systemd timer
# every minute (see provision.sh). No Prometheus, no extra daemon.
#
# It only checks STATELESS conditions (gauges that describe the box right now:
# disk, janitor heartbeat, inflight saturation, stuck queue). Rate-based trends
# (shed rate, error rate) want a real scraper with history; this script stays
# simple on purpose and the alerts.example.yml rules cover those when you wire a
# scraper later.
#
# Email needs an outbound mail command on the box. By default it pipes the
# message to `sendmail -t`; install one (e.g. msmtp with a Gmail app password,
# providing /usr/sbin/sendmail) or point STI_ALERT_SENDER at any command that
# reads an RFC822 message on stdin. With no sender configured it logs to the
# journal so the check is never silently lost.
set -euo pipefail

METRICS_URL="${STI_METRICS_URL:-http://127.0.0.1:9090/metrics}"
EMAIL="${STI_ALERT_EMAIL:-obartra@gmail.com}"
FROM="${STI_ALERT_FROM:-stiapi-alerts@sti.care}"
SENDER="${STI_ALERT_SENDER:-sendmail -t}"
HOST="$(hostname)"

# Thresholds (kept in step with alerts.example.yml).
DISK_MIN_BYTES="${STI_ALERT_DISK_MIN:-2000000000}" # 2 GB
JANITOR_STALE_SEC="${STI_ALERT_JANITOR_STALE:-300}"
QUEUE_AGE_SEC="${STI_ALERT_QUEUE_AGE:-600}"
INFLIGHT_RATIO="${STI_ALERT_INFLIGHT_RATIO:-0.9}"

metrics="$(curl -fsS --max-time 5 "$METRICS_URL" 2>/dev/null || true)"
if [ -z "$metrics" ]; then
	echo "stiapi-alert: metrics endpoint unreachable at $METRICS_URL" >&2
	exit 0
fi

# val NAME -> the value of an unlabeled gauge line "NAME <value>", or empty.
val() { awk -v n="$1" '$1==n{print $2; exit}' <<<"$metrics"; }

now="$(date +%s)"
alerts=()

disk="$(val sti_disk_free_bytes)"
if [ -n "$disk" ] && [ "$disk" -lt "$DISK_MIN_BYTES" ]; then
	alerts+=("disk free ${disk} bytes is below ${DISK_MIN_BYTES}")
fi

janitor="$(val sti_janitor_last_run_seconds)"
if [ -n "$janitor" ] && [ "$janitor" -gt 0 ]; then
	age=$((now - janitor))
	if [ "$age" -gt "$JANITOR_STALE_SEC" ]; then
		alerts+=("background janitor last ran ${age}s ago (stalled)")
	fi
fi

qage="$(val sti_send_queue_oldest_age_seconds)"
if [ -n "$qage" ] && [ "$qage" -gt "$QUEUE_AGE_SEC" ]; then
	alerts+=("oldest queued send is ${qage}s old (drain may be stuck)")
fi

cur="$(val sti_inflight_current)"
max="$(val sti_inflight_max)"
if [ -n "$cur" ] && [ -n "$max" ] && [ "$max" -gt 0 ]; then
	over="$(awk -v c="$cur" -v m="$max" -v r="$INFLIGHT_RATIO" 'BEGIN{print (c/m > r) ? 1 : 0}')"
	if [ "$over" = 1 ]; then
		alerts+=("in-flight ${cur}/${max} is above ${INFLIGHT_RATIO} of the cap")
	fi
fi

[ "${#alerts[@]}" -eq 0 ] && exit 0

body="sti.care alert on ${HOST} at $(date -u '+%Y-%m-%d %H:%M:%SZ')"$'\n\n'
for a in "${alerts[@]}"; do body+="- ${a}"$'\n'; done

message="To: ${EMAIL}
From: ${FROM}
Subject: [sti.care] ${#alerts[@]} alert(s) on ${HOST}

${body}"

if command -v "${SENDER%% *}" >/dev/null 2>&1; then
	printf '%s\n' "$message" | $SENDER
	echo "stiapi-alert: sent ${#alerts[@]} alert(s) to ${EMAIL}" >&2
else
	# No mailer configured: at least surface it in the journal.
	echo "stiapi-alert: no sender (${SENDER%% *}); ${#alerts[@]} alert(s):" >&2
	printf '%s\n' "${alerts[@]}" >&2
fi
