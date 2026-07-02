#!/usr/bin/env bash
# Verify visual-baselines/ exactly matches the built page corpus: one PNG per
# dist/*.html page per breakpoint width (390 phone, 1440 desktop; lost-pixel
# names them {slug}__[w390px].png), the same corpus lostpixel.config.cjs
# captures. Missing (page without PNG) or stale (PNG without page) fails. Same
# mechanism as passport/scripts/check-baselines.sh.
#
# Usage:
#   check-baselines.sh           # exit 1 on missing or stale baselines
#   check-baselines.sh --prune   # rm stale first, then assert none missing

set -euo pipefail
cd "$(dirname "$0")/.."

PRUNE=
if [[ "${1:-}" == "--prune" ]]; then PRUNE=1; fi

if ! ls dist/*.html > /dev/null 2>&1; then
  echo "::error::dist/ has no pages. Run \`npm run build\` first."
  exit 1
fi

expected=$(
  for f in dist/*.html; do
    slug="$(basename "$f" .html)"
    printf '%s__[w390px].png\n%s__[w1440px].png\n' "$slug" "$slug"
  done | sort -u
)
actual=$(
  find visual-baselines -maxdepth 1 -name '*.png' -print0 2>/dev/null | xargs -0 -n1 basename 2>/dev/null | sort -u
)

missing=$(comm -23 <(echo "$expected") <(echo "$actual") || true)
stale=$(comm -13 <(echo "$expected") <(echo "$actual") || true)
missing=$(printf '%s' "$missing" | sed '/^$/d')
stale=$(printf '%s' "$stale" | sed '/^$/d')

fail=0
if [[ -n "$stale" ]]; then
  if [[ -n "$PRUNE" ]]; then
    echo "→ Pruning stale baselines:"
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      echo "  rm visual-baselines/$f"; rm -- "visual-baselines/$f"
    done <<<"$stale"
  else
    echo "::error::Stale baselines (PNGs without a corresponding page):"
    printf '  %s\n' "${stale//$'\n'/$'\n'  }"; fail=1
  fi
fi
if [[ -n "$missing" ]]; then
  echo "::error::Missing baselines (pages without a corresponding PNG):"
  printf '  %s\n' "${missing//$'\n'/$'\n'  }"; fail=1
fi
if [[ $fail -eq 1 ]]; then
  echo; echo "Add the 'screenshot:update' label to the PR to regenerate baselines,"
  echo "or run \`npm run test:visual:update\` locally and commit the result."
  exit 1
fi
echo "→ Baselines match the page corpus."
