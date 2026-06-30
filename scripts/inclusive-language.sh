#!/usr/bin/env bash
#
# Inclusive-language gate. The product is built around openness, tolerance, and no
# judgement, so the codebase holds itself to the same standard and avoids
# exclusionary terms. This is a CI gate (see `make inclusive-language`).
#
# Denied terms (whole word, case-insensitive): master, slave, whitelist, blacklist.
# Use: account key / root key, allowlist / denylist, primary / replica.
#
# Deliberately NOT denied: "blind" is a core, intentional product term (the
# blind-store boundary), used with meaning, not as a slur, so it is allowed.
#
# Allowlist: two crypto domain-separation constants in passport/src/crypto/keys.ts
# contain "master-key" in their VALUE ("sti.care/master-key/v1"). Changing that
# string re-keys every existing account, so the values are frozen; only the
# identifiers were renamed. Those lines are exempt.
set -euo pipefail

cd "$(dirname "$0")/.."

PATTERN='\b(master|slave|whitelist|blacklist)\b'
ALLOW='sti.care/master-key' # frozen crypto domain-separation constants (keys.ts)

# Scan tracked files only (skips node_modules, dist, storybook-static, .git), minus
# this script itself, which necessarily names the denied terms.
matches="$(
  git ls-files \
    | grep -vE '(^|/)scripts/inclusive-language\.sh$' \
    | xargs grep -EnIH -i "$PATTERN" 2>/dev/null \
    | grep -v "$ALLOW" \
    || true
)"

if [ -n "$matches" ]; then
  echo "Inclusive-language check failed. Replace these terms:"
  echo "  master/slave -> account key / root key, primary / replica"
  echo "  whitelist/blacklist -> allowlist / denylist"
  echo
  echo "$matches"
  exit 1
fi

echo "Inclusive-language check passed."
