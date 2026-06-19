#!/usr/bin/env bash
#
# Provision (idempotently) the sti.care API box. Run as root on the server.
# Expects, staged in /tmp/stideploy: the `stiapi` binary, stiapi.service, Caddyfile.
#
#   scp the staging dir, then: ssh root@host 'bash /tmp/stideploy/provision.sh'
#
set -euo pipefail
STAGE=/tmp/stideploy

# 1. Service user (no login, no home).
id -u stiapi &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin stiapi

# 2. Binary.
install -m 0755 "$STAGE/stiapi" /usr/local/bin/stiapi

# 3. Config + secret. The decoy secret is generated ON the box and never leaves it.
if [ ! -f /etc/stiapi.env ]; then
	secret="$(openssl rand -hex 32)"
	umask 077
	cat >/etc/stiapi.env <<EOF
STI_ADDR=127.0.0.1:8080
STI_DB_PATH=/var/lib/stiapi/sti.db
STI_DECOY_SECRET=$secret
# Browser origins allowed to call the api cross-origin (the passport app). Exact
# match, comma-separated. Add deploy-preview origins here if they should resolve
# against production.
STI_ALLOWED_ORIGINS=https://sti.care
EOF
	chown root:stiapi /etc/stiapi.env
	chmod 0640 /etc/stiapi.env
	echo "generated /etc/stiapi.env"
fi

# 4. systemd unit (StateDirectory creates /var/lib/stiapi owned by the service user).
install -m 0644 "$STAGE/stiapi.service" /etc/systemd/system/stiapi.service
systemctl daemon-reload
systemctl enable --now stiapi
systemctl restart stiapi

# 5. Caddy (pinned official release, checksum-verified) as the public TLS front.
# Clean up any leftovers from an earlier apt-repo attempt.
rm -f /etc/apt/sources.list.d/caddy-stable.list /usr/share/keyrings/caddy-stable-archive-keyring.gpg
CADDY_VERSION="v2.11.4"
CADDY_SHA512="8220d1f013b6f27510247b2360c9e0ca9f018feebd82515f07635318b34ff9777ccc8fd0b6e6f2486ce3a33fe389fbb7db12d05baa474f4587509fb4f5ebf1c9"
if ! /usr/local/bin/caddy version 2>/dev/null | grep -q "$CADDY_VERSION"; then
	ctmp="$(mktemp -d)"
	curl -fsSL "https://github.com/caddyserver/caddy/releases/download/${CADDY_VERSION}/caddy_${CADDY_VERSION#v}_linux_amd64.tar.gz" -o "$ctmp/caddy.tgz"
	echo "${CADDY_SHA512}  ${ctmp}/caddy.tgz" | sha512sum -c - || {
		echo "Caddy checksum mismatch, refusing to install" >&2
		exit 1
	}
	tar -xzf "$ctmp/caddy.tgz" -C "$ctmp" caddy
	install -m 0755 "$ctmp/caddy" /usr/local/bin/caddy
	rm -rf "$ctmp"
fi
id -u caddy &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin caddy
mkdir -p /etc/caddy /etc/caddy/tls /var/lib/caddy
chown caddy:caddy /var/lib/caddy

# 5b. TLS material. We do NOT use ACME: the origin firewall is locked to
# Cloudflare IPs and the edge forces HTTPS, so a Let's Encrypt challenge can
# never reach Caddy. Instead Caddy serves a Cloudflare Origin Certificate
# (15-year, CF-trusted) and requires Cloudflare's client cert (Authenticated
# Origin Pulls). The Origin Pull CA is public and fetched here; the origin
# private key is generated ON the box and never leaves it.
CF_OPULL_CA_SHA256="c14fed0ce5210db0719fea11d1f10b33750dc17d609aeaf47c75e9eff0d7b843"
if [ ! -f /etc/caddy/tls/cf-origin-pull-ca.pem ]; then
	catmp="$(mktemp)"
	curl -fsSL https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem -o "$catmp"
	echo "${CF_OPULL_CA_SHA256}  ${catmp}" | sha256sum -c - || {
		echo "CF origin-pull CA checksum mismatch, refusing to install" >&2
		rm -f "$catmp"; exit 1
	}
	install -m 0644 -o root -g caddy "$catmp" /etc/caddy/tls/cf-origin-pull-ca.pem
	rm -f "$catmp"
fi
if [ ! -f /etc/caddy/tls/origin.key ]; then
	openssl ecparam -name prime256v1 -genkey -noout -out /etc/caddy/tls/origin.key
	chown root:caddy /etc/caddy/tls/origin.key
	chmod 0640 /etc/caddy/tls/origin.key
fi
# The signed cert can only come from Cloudflare. If it isn't present, emit the
# CSR + instructions and skip starting Caddy (rather than crash-loop it on a
# missing cert). Re-run provision.sh after installing the cert.
if [ ! -f /etc/caddy/tls/origin.crt ]; then
	openssl req -new -key /etc/caddy/tls/origin.key -subj "/CN=api.sti.care" -out /tmp/origin.csr
	echo "------------------------------------------------------------------" >&2
	echo "No origin cert yet. In the Cloudflare dashboard:" >&2
	echo "  SSL/TLS > Origin Server > Create Certificate > 'Use my private" >&2
	echo "  key and CSR', paste the CSR below, then save the PEM to" >&2
	echo "  /etc/caddy/tls/origin.crt (chown root:caddy, chmod 0644) and" >&2
	echo "  re-run this script. Also enable Authenticated Origin Pulls" >&2
	echo "  (Global) in the same section." >&2
	echo "------------------------------------------------------------------" >&2
	cat /tmp/origin.csr >&2
	echo "skipping Caddy start until origin cert is installed" >&2
	CADDY_TLS_READY=0
else
	CADDY_TLS_READY=1
fi
cat >/etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile --force
Restart=on-failure
RestartSec=2
AmbientCapabilities=CAP_NET_BIND_SERVICE
Environment=XDG_DATA_HOME=/var/lib XDG_CONFIG_HOME=/var/lib
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
UNIT
install -m 0644 "$STAGE/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
if [ "${CADDY_TLS_READY:-0}" = "1" ]; then
	systemctl enable --now caddy
	systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

# 5c. Nightly DB backup (consistent snapshot, keep 7) via a systemd timer.
command -v sqlite3 &>/dev/null || { apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3; }
install -m 0755 "$STAGE/backup.sh" /usr/local/bin/stiapi-backup
install -d -o stiapi -g stiapi /var/lib/stiapi/backups
cat >/etc/systemd/system/stiapi-backup.service <<'UNIT'
[Unit]
Description=sti.care DB backup

[Service]
Type=oneshot
User=stiapi
Group=stiapi
ExecStart=/usr/local/bin/stiapi-backup
UNIT
cat >/etc/systemd/system/stiapi-backup.timer <<'UNIT'
[Unit]
Description=Nightly sti.care DB backup

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now stiapi-backup.timer

# 5d. Restricted CI deploy: a non-root `deploy` user that may run ONLY the
# install-and-restart script as root, and only if a CI public key is staged.
install -m 0755 "$STAGE/stiapi-deploy.sh" /usr/local/bin/stiapi-deploy
if [ -f "$STAGE/ci_deploy.pub" ]; then
	id -u deploy &>/dev/null || useradd --create-home --shell /bin/bash deploy
	install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
	install -m 0600 -o deploy -g deploy "$STAGE/ci_deploy.pub" /home/deploy/.ssh/authorized_keys
	# No-args: the deploy user may run the script with NO arguments only; it uses a
	# fixed staging path, so a leaked key can't point it at an arbitrary file.
	echo 'deploy ALL=(root) NOPASSWD: /usr/local/bin/stiapi-deploy ""' >/etc/sudoers.d/stiapi-deploy
	chmod 0440 /etc/sudoers.d/stiapi-deploy
	visudo -cf /etc/sudoers.d/stiapi-deploy >/dev/null
	echo "configured restricted deploy user"
fi

# 6. Firewall: SSH from anywhere; HTTP(S) ONLY from Cloudflare, so the origin
# can't be reached directly (which would bypass Cloudflare's WAF/DDoS/edge).
# Fetch the Cloudflare ranges FIRST; only lock down if we got them, else leave
# 80/443 open rather than risk a self-inflicted outage.
if command -v ufw &>/dev/null; then
	cfips="$( { curl -fsS https://www.cloudflare.com/ips-v4 && echo && curl -fsS https://www.cloudflare.com/ips-v6; } 2>/dev/null || true)"
	ufw --force reset >/dev/null 2>&1 || true
	ufw default deny incoming >/dev/null 2>&1 || true
	ufw default allow outgoing >/dev/null 2>&1 || true
	ufw allow OpenSSH >/dev/null 2>&1 || true
	if [ -n "$cfips" ]; then
		for ip in $cfips; do
			ufw allow from "$ip" to any port 80 proto tcp >/dev/null 2>&1 || true
			ufw allow from "$ip" to any port 443 proto tcp >/dev/null 2>&1 || true
		done
		echo "firewall: 80/443 restricted to Cloudflare ranges"
	else
		ufw allow 80/tcp >/dev/null 2>&1 || true
		ufw allow 443/tcp >/dev/null 2>&1 || true
		echo "firewall: could not fetch Cloudflare ranges; left 80/443 open"
	fi
	ufw --force enable >/dev/null 2>&1 || true
fi

echo "--- stiapi ---"
systemctl --no-pager --lines=0 status stiapi | head -4
echo "--- local healthz ---"
curl -fsS http://127.0.0.1:8080/healthz && echo
