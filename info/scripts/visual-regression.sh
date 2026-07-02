#!/usr/bin/env bash
# Run lost-pixel visual regression for the info site in the pinned lost-pixel
# Docker image, the same mechanism as passport/scripts/visual-regression.sh:
# Docker keeps rendering byte-stable across macOS dev and ubuntu-latest CI. The
# corpus here is small (static pages at two viewports), so there is no shard
# mode; the blank-capture guard carries over.
#
# Usage:
#   scripts/visual-regression.sh            # diff against baselines, exit 1 on mismatch
#   scripts/visual-regression.sh --update   # write/replace baselines, then prune orphans
#
# Prereqs: Docker daemon running. On Apple Silicon, Rosetta 2.

set -euo pipefail
cd "$(dirname "$0")/.."

MODE=
while [[ $# -gt 0 ]]; do
  case "$1" in
    --update) MODE=update ;;
    *) echo "::error::unknown argument: $1"; exit 2 ;;
  esac
  shift
done

LP_VERSION="v3.22.0"
SERVER_PORT="${LOST_PIXEL_INFO_PORT:-6067}"
SERVER_PID=

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! ls dist/*.html > /dev/null 2>&1; then
  echo "→ Building the info site…"
  npm run build
fi

if ! docker info > /dev/null 2>&1; then
  echo "::error::Docker daemon is not running. Visual regression requires Docker for byte-stable rendering."
  exit 1
fi

if [[ "$(uname)" == "Darwin" ]] && [[ "$(uname -m)" == "arm64" ]]; then
  if ! arch -x86_64 true 2>/dev/null; then
    echo "::error::Rosetta 2 is required for byte-stable amd64 rendering on Apple Silicon."
    echo "  Install: softwareupdate --install-rosetta"
    exit 1
  fi
fi

echo "→ Serving dist/ on :$SERVER_PORT"
( cd dist && python3 -m http.server "$SERVER_PORT" --bind 127.0.0.1 ) > /tmp/info-static.log 2>&1 &
SERVER_PID=$!

for _ in {1..40}; do
  curl -sf "http://127.0.0.1:$SERVER_PORT/index.html" > /dev/null 2>&1 && break
  sleep 0.25
done
if ! curl -sf "http://127.0.0.1:$SERVER_PORT/index.html" > /dev/null 2>&1; then
  echo "::error::Static server failed to start on :$SERVER_PORT"; tail -20 /tmp/info-static.log || true; exit 1
fi

if [[ "$(uname)" == "Linux" ]]; then
  NETWORK_FLAGS=(--network host)
  BASE_URL="http://127.0.0.1:$SERVER_PORT"
else
  NETWORK_FLAGS=(--add-host=host.docker.internal:host-gateway)
  BASE_URL="http://host.docker.internal:$SERVER_PORT"
fi

mkdir -p .lostpixel visual-baselines

if [[ -z "$MODE" ]]; then
  echo "→ Checking baseline shape against dist/"
  ./scripts/check-baselines.sh
fi

echo "→ Running lost-pixel ${MODE:-test} (baseUrl=$BASE_URL)"
lp_run() {
  local only_ids="$1"; shift
  local extra_env=()
  [[ -n "$only_ids" ]] && extra_env+=(-e "LOST_PIXEL_ONLY_IDS=$only_ids")
  [[ -n "${LP_BASELINE_DIR:-}" ]] && extra_env+=(-e "LOST_PIXEL_BASELINE_DIR=$LP_BASELINE_DIR")
  [[ -n "${LOST_PIXEL_CONCURRENCY:-}" ]] && extra_env+=(-e "LOST_PIXEL_CONCURRENCY=$LOST_PIXEL_CONCURRENCY")
  docker run --rm \
    --platform linux/amd64 \
    "${NETWORK_FLAGS[@]}" \
    -v "$PWD:/work" \
    -w /work \
    -e "LOST_PIXEL_PAGE_BASE_URL=$BASE_URL" \
    "${extra_env[@]}" \
    --user "$(id -u):$(id -g)" \
    "lostpixel/lost-pixel:$LP_VERSION" "$@"
}

# A baseline PNG smaller than this is a blank/half-painted capture, not a real
# render (every real page baseline is comfortably larger).
BLANK_FLOOR=10000

# Re-shoot one shot in isolation. Shot names are {slug}__[w390px]; the config
# filters by page name (the slug), so both widths of the slug re-shoot into the
# throwaway dir and only the requested file is copied back.
recapture_one() {
  local id="$1"
  local page="${id%%__*}"
  local tmp=".lostpixel/recapture"
  rm -rf "$tmp"; mkdir -p "$tmp"
  LP_BASELINE_DIR="$tmp" lp_run "$page" update || true
  local shot="$tmp/${id}.png"
  if [[ -f "$shot" ]] && [[ -z "$(find "$shot" -size "-${BLANK_FLOOR}c")" ]]; then
    cp "$shot" "visual-baselines/${id}.png"
  fi
  rm -rf "$tmp"
  [[ -z "$(find "visual-baselines/${id}.png" -size "-${BLANK_FLOOR}c" 2>/dev/null)" ]]
}

if [[ "$MODE" == "update" ]]; then
  # --update exits 1 whenever it writes baselines; PNGs are on disk by then, so
  # tolerate it and let check-baselines.sh --prune be the real gate.
  lp_run "" update || true
  ./scripts/check-baselines.sh --prune
  for attempt in 1 2 3 4 5; do
    blanks="$(find visual-baselines -name '*.png' -size "-${BLANK_FLOOR}c")"
    [[ -z "$blanks" ]] && break
    echo "→ Re-capturing blank shot(s) in isolation (attempt ${attempt}):"
    for f in $blanks; do
      id="$(basename "$f" .png)"
      echo "    ${id}"
      recapture_one "$id" || true
    done
  done
  blanks="$(find visual-baselines -name '*.png' -size "-${BLANK_FLOOR}c")"
  if [[ -n "$blanks" ]]; then
    echo "::error::Blank baselines persist after retries:"
    printf '  %s\n' $blanks
    exit 1
  fi
else
  lp_run "" || true

  diffs=()
  for f in .lostpixel/difference/*.png; do
    [[ -e "$f" ]] && diffs+=("$(basename "$f" .png)")
  done
  if [[ ${#diffs[@]} -eq 0 ]]; then
    echo "→ Visual diff clean."
    exit 0
  fi
  # Too many to be capture artifacts: this is an intended change. Fail fast and
  # let the screenshot:update label regenerate, rather than re-shoot dozens.
  if [[ ${#diffs[@]} -gt 8 ]]; then
    echo "::error::${#diffs[@]} pages differ (intended change? use screenshot:update):"
    printf '  %s\n' "${diffs[@]}"
    exit 1
  fi

  real=()
  for id in "${diffs[@]}"; do
    healed=
    for attempt in 1 2 3; do
      echo "→ Re-shooting in isolation (attempt ${attempt}): ${id}"
      lp_run "$id" || true
      [[ ! -e ".lostpixel/difference/${id}.png" ]] && {
        healed=1
        break
      }
    done
    [[ -z "$healed" ]] && real+=("$id")
  done

  if [[ ${#real[@]} -gt 0 ]]; then
    echo "::error::Visual differences (persist when re-shot in isolation):"
    printf '  %s\n' "${real[@]}"
    exit 1
  fi
  echo "→ Visual diff clean (${#diffs[@]} capture artifact(s) re-shot in isolation)."
fi
