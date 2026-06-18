#!/usr/bin/env bash
#
# The ONLY thing the CI deploy user may run as root (via a locked sudoers rule).
# It installs a freshly built binary and restarts the service, then verifies
# health. It deliberately does nothing else: systemd-unit, Caddy, firewall, and
# user changes stay in provision.sh, run manually as root. So a leaked CI key can
# at most ship a new binary, not reconfigure the box.
set -euo pipefail
# Fixed staging path (NOT an argument): the sudoers rule allows no args, so a
# leaked deploy key cannot point this at an arbitrary file to install as root.
STAGED=/tmp/stiapi.new

[ -f "$STAGED" ] || { echo "no staged binary at $STAGED" >&2; exit 1; }
# ELF magic (7f 45 4c 46), checked without depending on the `file` tool.
[ "$(head -c4 "$STAGED" | od -An -tx1 | tr -d ' \n')" = "7f454c46" ] || { echo "staged file is not an ELF binary" >&2; exit 1; }

install -m 0755 "$STAGED" /usr/local/bin/stiapi
rm -f "$STAGED"
systemctl restart stiapi
sleep 1
curl -fsS http://127.0.0.1:8080/healthz >/dev/null || { echo "healthz failed after restart" >&2; exit 1; }
echo "deployed + healthy"
