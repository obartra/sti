#!/usr/bin/env bash
#
# secrets.sh: manage the server's env secrets (/etc/stiapi.env) as an encrypted,
# committed file, and push them to the box over SSH. Encryption is age, keyed to
# your SSH key, so the only thing you need to read or change secrets is the same
# SSH key you already use for the server.
#
#   - At rest: secrets/stiapi.env.age, encrypted to the SSH public keys in
#     secrets/recipients.txt. Safe to commit. Plaintext never touches the repo.
#   - To read/edit: decrypted in memory (or a 0600 temp file for `edit`), with
#     your SSH private key.
#   - To deploy: `sync` decrypts locally and pipes the plaintext straight into
#     /etc/stiapi.env over SSH, then restarts the service. No plaintext is ever
#     written to disk locally or on the box.
#
# Usage:
#   ./secrets.sh init                 set up: add your SSH key as a recipient,
#                                     create an empty encrypted store
#   ./secrets.sh list                 list keys (values masked)
#   ./secrets.sh show [KEY]           print everything, or one KEY (plaintext!)
#   ./secrets.sh set KEY [VALUE]      add or update a key (prompts if VALUE omitted)
#   ./secrets.sh rm KEY               remove a key
#   ./secrets.sh edit                 open the whole file in $EDITOR, re-encrypt on save
#   ./secrets.sh sync                 push to the server and restart the service
#   ./secrets.sh recipients [add KEY] list or add an SSH public key that may decrypt
#
# Config (env vars, with sensible defaults):
#   SECRETS_SSH           ssh target for `sync`, e.g. root@origin.sti.care (required for sync)
#   SECRETS_IDENTITY      SSH private key used to decrypt   (default ~/.ssh/id_ed25519)
#   SECRETS_REMOTE_PATH   env file on the box               (default /etc/stiapi.env)
#   SECRETS_REMOTE_OWNER  owner:group for that file         (default root:stiapi)
#   SECRETS_REMOTE_MODE   mode for that file                (default 0640)
#   SECRETS_SERVICE       systemd service to restart        (default stiapi)
#   SECRETS_SUDO          set to "sudo" if SECRETS_SSH is a non-root sudo user
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STORE="$HERE/secrets"
ENC="$STORE/stiapi.env.age"
RECIP="$STORE/recipients.txt"

IDENTITY="${SECRETS_IDENTITY:-$HOME/.ssh/id_ed25519}"
SSH_TARGET="${SECRETS_SSH:-}"
REMOTE_PATH="${SECRETS_REMOTE_PATH:-/etc/stiapi.env}"
REMOTE_OWNER="${SECRETS_REMOTE_OWNER:-root:stiapi}"
REMOTE_MODE="${SECRETS_REMOTE_MODE:-0640}"
SERVICE="${SECRETS_SERVICE:-stiapi}"
SUDO="${SECRETS_SUDO:-}"

die() {
  echo "secrets: $*" >&2
  exit 1
}

need_age() {
  command -v age >/dev/null 2>&1 ||
    die "age not found. Install it: 'brew install age' (macOS) or 'apt install age' (Debian/Ubuntu). https://github.com/FiloSottile/age"
}

need_identity() {
  [ -f "$IDENTITY" ] || die "SSH key not found at $IDENTITY (set SECRETS_IDENTITY)."
}

need_store() {
  [ -f "$ENC" ] || die "no encrypted store yet. Run '$0 init' first."
  [ -s "$RECIP" ] || die "no recipients yet. Run '$0 init' or '$0 recipients add <ssh-pubkey>'."
}

# Decrypt the store to stdout. Fails closed: a bad key or corrupt file errors out.
decrypt() {
  need_age
  need_identity
  age -d -i "$IDENTITY" "$ENC"
}

# Encrypt stdin to the store, atomically (write to a temp, then move).
encrypt_stdin() {
  need_age
  [ -s "$RECIP" ] || die "no recipients in $RECIP; add one with '$0 recipients add <ssh-pubkey>'."
  local tmp
  tmp="$(mktemp "$STORE/.stiapi.env.age.XXXXXX")"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" RETURN
  age -R "$RECIP" -o "$tmp"
  mv -f "$tmp" "$ENC"
}

# Public key derived from the configured SSH private key.
pubkey_from_identity() {
  if [ -f "$IDENTITY.pub" ]; then
    cat "$IDENTITY.pub"
  else
    ssh-keygen -y -f "$IDENTITY"
  fi
}

cmd_init() {
  need_age
  need_identity
  mkdir -p "$STORE"
  if [ ! -s "$RECIP" ]; then
    pubkey_from_identity | awk '{print $1, $2}' >"$RECIP"
    echo "secrets: added your key ($IDENTITY.pub) as a recipient."
  fi
  if [ ! -f "$ENC" ]; then
    printf '# stiapi.env, managed by secrets.sh. KEY=value per line.\n' | encrypt_stdin
    echo "secrets: created empty $ENC."
  fi
  echo "secrets: ready. Try '$0 set STI_EXAMPLE hello' then '$0 list'."
}

cmd_list() {
  need_store
  # Show keys with masked values; keep comments/blanks out of the listing.
  decrypt | sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p'
}

cmd_show() {
  need_store
  local key="${1:-}"
  if [ -z "$key" ]; then
    decrypt
  else
    decrypt | sed -n "s/^${key}=//p" | head -n1
  fi
}

# Upsert KEY=VALUE in the env text on stdin, preserving everything else.
upsert() {
  local key="$1" val="$2"
  awk -v k="$key" -v v="$val" '
    $0 ~ "^" k "=" { print k "=" v; found=1; next }
    { print }
    END { if (!found) print k "=" v }
  '
}

cmd_set() {
  need_store
  local key="${1:-}"
  [ -n "$key" ] || die "usage: $0 set KEY [VALUE]"
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "invalid key '$key' (use A-Z, 0-9, _)."
  local val
  if [ "$#" -ge 2 ]; then
    val="$2"
  else
    # Read without echoing, so the value never lands in shell history or the screen.
    read -r -s -p "Value for $key: " val
    echo
  fi
  decrypt | upsert "$key" "$val" | encrypt_stdin
  echo "secrets: set $key."
}

cmd_rm() {
  need_store
  local key="${1:-}"
  [ -n "$key" ] || die "usage: $0 rm KEY"
  decrypt | grep -v "^${key}=" | encrypt_stdin
  echo "secrets: removed $key."
}

cmd_edit() {
  need_store
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/stiapi.env.XXXXXX")"
  chmod 600 "$tmp"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" EXIT
  decrypt >"$tmp"
  local before
  before="$(cksum <"$tmp")"
  # Unquoted so a multi-word $EDITOR (e.g. "code --wait") word-splits into argv.
  local editor="${VISUAL:-${EDITOR:-vi}}"
  # shellcheck disable=SC2086
  $editor "$tmp"
  if [ "$(cksum <"$tmp")" = "$before" ]; then
    echo "secrets: no changes."
    return
  fi
  encrypt_stdin <"$tmp"
  echo "secrets: saved."
}

cmd_recipients() {
  local sub="${1:-list}"
  case "$sub" in
    list)
      [ -s "$RECIP" ] && cat "$RECIP" || echo "(none yet)"
      ;;
    add)
      local key="${2:-}"
      [ -n "$key" ] || die "usage: $0 recipients add '<ssh-ed25519 AAAA...>'"
      mkdir -p "$STORE"
      echo "$key" | awk '{print $1, $2}' >>"$RECIP"
      # Re-encrypt to the new recipient set so it can decrypt going forward.
      [ -f "$ENC" ] && decrypt | encrypt_stdin
      echo "secrets: added recipient and re-encrypted."
      ;;
    *) die "unknown recipients subcommand '$sub' (list|add)" ;;
  esac
}

cmd_sync() {
  need_store
  [ -n "$SSH_TARGET" ] || die "set SECRETS_SSH (e.g. root@origin.sti.care) to sync."
  # Decrypt into memory first and fail closed: a bad key or empty store must never
  # push a blank env file (which would restart the service with no secrets).
  local plain
  plain="$(decrypt)" || die "decrypt failed; nothing synced."
  [ -n "$plain" ] || die "decrypted store is empty; nothing synced."
  echo "secrets: pushing to $SSH_TARGET:$REMOTE_PATH and restarting $SERVICE..."
  # Pipe the plaintext straight into install over SSH, so no plaintext file is
  # written to disk here or on the box. install sets owner+mode atomically. The
  # config vars expand here (client side, all trusted local values); only the
  # secret content crosses the wire, on stdin, never in the command string.
  # shellcheck disable=SC2029
  printf '%s' "$plain" | ssh "$SSH_TARGET" \
    "${SUDO:+$SUDO }install -m '$REMOTE_MODE' -o '${REMOTE_OWNER%:*}' -g '${REMOTE_OWNER#*:}' /dev/stdin '$REMOTE_PATH' \
     && ${SUDO:+$SUDO }systemctl restart '$SERVICE' \
     && ${SUDO:+$SUDO }systemctl is-active '$SERVICE'"
  echo "secrets: synced and $SERVICE is active."
}

usage() {
  local me
  me="$(basename "${BASH_SOURCE[0]}")"
  cat <<EOF
$me: manage the server's env secrets (/etc/stiapi.env), encrypted in the repo
with your SSH key. Read, edit, and push them with the same key you use for SSH.

Usage: ./$me <command> [args]

Commands:
  list                   list key names, values masked
  show [KEY]             print every secret, or just KEY (plaintext)
  set KEY [VALUE]        add or update a key; prompts for VALUE if omitted (no echo)
  rm KEY                 remove a key
  edit                   open the whole file in \$EDITOR, re-encrypt on save
  sync                   decrypt and push to the box over SSH, then restart the service
  recipients [add KEY]   list, or add an SSH public key allowed to decrypt
  init                   first-time setup: add your key, create an empty store
  help                   show this help

Examples:
  ./$me init
  ./$me set STI_ADMIN_TOKEN                       # prompts, no echo
  ./$me list
  ./$me show STI_DECOY_SECRET
  ./$me edit
  SECRETS_SSH=root@origin.sti.care ./$me sync
  ./$me recipients add 'ssh-ed25519 AAAA... them@laptop'

Config (environment variables):
  SECRETS_SSH           ssh target for sync, e.g. root@origin.sti.care (required)
  SECRETS_IDENTITY      SSH key used to decrypt (default ~/.ssh/id_ed25519)
  SECRETS_REMOTE_PATH   env file on the box (default /etc/stiapi.env)
  SECRETS_REMOTE_OWNER  owner:group for the file (default root:stiapi)
  SECRETS_REMOTE_MODE   mode for the file (default 0640)
  SECRETS_SERVICE       service to restart (default stiapi)
  SECRETS_SUDO          set to "sudo" if SECRETS_SSH is a sudo user, not root

Secrets live encrypted (age) in secrets/stiapi.env.age, readable only by the SSH keys
in secrets/recipients.txt. Plaintext never touches the repo or disk; sync streams it
over SSH on stdin and the service is restarted. See SECRETS.md for the full story.
EOF
}

main() {
  local cmd="${1:-help}"
  shift || true
  case "$cmd" in
    init) cmd_init "$@" ;;
    list | ls) cmd_list "$@" ;;
    show | get | view) cmd_show "$@" ;;
    set | add) cmd_set "$@" ;;
    rm | remove | del) cmd_rm "$@" ;;
    edit) cmd_edit "$@" ;;
    recipients | recip) cmd_recipients "$@" ;;
    sync | push) cmd_sync "$@" ;;
    help | -h | --help) usage ;;
    *) die "unknown command '$cmd'. Run '$0 help'." ;;
  esac
}

main "$@"
