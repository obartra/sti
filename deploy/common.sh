# shellcheck shell=bash
# Shared helpers for the deploy scripts. Sourced, not executed.
# Every function writes human output to stderr so callers can capture stdout.

log() { printf '%s\n' "$*" >&2; }
die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

# Absolute repo root, given any path inside the repo.
repo_root() { git -C "$1" rev-parse --show-toplevel; }

# Normalize a git remote (git@github.com:owner/repo.git or https form) to a
# browsable web URL.
web_url() {
  printf '%s' "$1" \
    | sed -E -e 's#^git@github\.com:#https://github.com/#' -e 's#\.git$##'
}

# Newest top-level *.zip in the given dir (by mtime), or empty if none. Always
# exits 0 (the trailing `|| true` keeps a no-match `ls` from tripping a caller's
# `set -e`/`pipefail` on the command substitution).
find_latest_zip() {
  # shellcheck disable=SC2012  # ls -t is the simplest mtime sort; names are controlled.
  ls -t "$1"/*.zip 2>/dev/null | head -1 || true
}

# Print the leading comment block of a script as help text (line-number free).
print_help() {
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$1"
}
