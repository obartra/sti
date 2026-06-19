#!/usr/bin/env bash
# Verify visual-baselines/ exactly matches the story corpus in
# storybook-static/index.json (one PNG per story; single theme). Copied from
# centaur. Missing (story without PNG) or stale (PNG without story) fails.
#
# Usage:
#   check-baselines.sh           # exit 1 on missing or stale baselines
#   check-baselines.sh --prune   # rm stale first, then assert none missing

set -euo pipefail
cd "$(dirname "$0")/.."

PRUNE=
if [[ "${1:-}" == "--prune" ]]; then PRUNE=1; fi

if [[ ! -f storybook-static/index.json ]]; then
  echo "::error::storybook-static/index.json not found. Run \`npm run build-storybook\` first."
  exit 1
fi

# Exclude the "Design System" styleguide, matching lostpixel.config.cjs: it is a
# reference catalogue (browsable at /design), not product UI, so it is not
# captured and must not be expected as a baseline.
expected=$(
  jq -r '.entries | to_entries[]
    | select(.value.type=="story")
    | select(.value.title | startswith("Design System") | not)
    | .key + ".png"' storybook-static/index.json | sort -u
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
    echo "::error::Stale baselines (PNGs without a corresponding story):"
    printf '  %s\n' "${stale//$'\n'/$'\n'  }"; fail=1
  fi
fi
if [[ -n "$missing" ]]; then
  echo "::error::Missing baselines (stories without a corresponding PNG):"
  printf '  %s\n' "${missing//$'\n'/$'\n'  }"; fail=1
fi
if [[ $fail -eq 1 ]]; then
  echo; echo "Add the 'screenshot:update' label to the PR to regenerate baselines,"
  echo "or run \`npm run test:visual:update\` locally and commit the result."
  exit 1
fi
echo "→ Baselines match the story corpus."
