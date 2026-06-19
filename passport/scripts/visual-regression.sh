#!/usr/bin/env bash
# Run lost-pixel visual regression in the pinned lost-pixel Docker image
# (copied from centaur). Docker keeps rendering byte-stable across macOS dev
# and ubuntu-latest CI: both invoke the same image, so committed baselines
# match. Running lost-pixel directly via npm produces different pixels on macOS
# and breaks the gate.
#
# Usage:
#   scripts/visual-regression.sh           # diff against baselines, exit 1 on mismatch
#   scripts/visual-regression.sh --update  # write/replace baselines, then prune orphans
#
# Prereqs: Docker daemon running. On Apple Silicon, Rosetta 2 (preflighted).

set -euo pipefail
cd "$(dirname "$0")/.."

MODE=
if [[ "${1:-}" == "--update" ]]; then MODE=update; fi

LP_VERSION="v3.22.0"
SERVER_PORT="${LOST_PIXEL_SB_PORT:-6066}"
SERVER_PID=

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ ! -f storybook-static/index.json ]]; then
  echo "→ Building Storybook…"
  npm run build-storybook
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

echo "→ Serving storybook-static/ on :$SERVER_PORT"
( cd storybook-static && python3 -m http.server "$SERVER_PORT" --bind 127.0.0.1 ) > /tmp/sb-static.log 2>&1 &
SERVER_PID=$!

for _ in {1..40}; do
  curl -sf "http://127.0.0.1:$SERVER_PORT/index.json" > /dev/null 2>&1 && break
  sleep 0.25
done
if ! curl -sf "http://127.0.0.1:$SERVER_PORT/index.json" > /dev/null 2>&1; then
  echo "::error::Storybook static server failed to start on :$SERVER_PORT"; tail -20 /tmp/sb-static.log || true; exit 1
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
  echo "→ Checking baseline shape against index.json"
  ./scripts/check-baselines.sh
fi

echo "→ Running lost-pixel ${MODE:-test} (baseUrl=$BASE_URL)"
# Run lost-pixel in the pinned image. Pass story ids to restrict the shot set to
# those ids (targeted re-capture) via $1; empty means the full suite. Any further
# args ("update") follow.
lp_run() {
  local only_ids="$1"; shift
  local extra_env=()
  [[ -n "$only_ids" ]] && extra_env+=(-e "LOST_PIXEL_ONLY_IDS=$only_ids")
  # When LP_BASELINE_DIR is set, write baselines there instead of visual-baselines/.
  # A filtered (only_ids) run prunes baselines outside its page set, so it must
  # target a throwaway dir, never the real one.
  [[ -n "${LP_BASELINE_DIR:-}" ]] && extra_env+=(-e "LOST_PIXEL_BASELINE_DIR=$LP_BASELINE_DIR")
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
# render (every real baseline is comfortably larger).
BLANK_FLOOR=10000

# Re-shoot a single story id and copy it back only if it came out non-blank. The
# capture targets a throwaway baseline dir because a filtered lost-pixel run
# prunes every baseline outside its page set; we never point that at the real
# dir. Returns 0 if the story is now non-blank in visual-baselines/.
recapture_one() {
  local id="$1"
  local tmp=".lostpixel/recapture"
  rm -rf "$tmp"; mkdir -p "$tmp"
  LP_BASELINE_DIR="$tmp" lp_run "$id" update || true
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
  # Capture-determinism guard. A heavy story very occasionally renders a near-
  # empty (blank) PNG under headless capture even with the mount-paint signal.
  # Re-running the whole suite just relocates the blank to a different random
  # story, so re-shoot ONLY each blank story in isolation (into a throwaway
  # baseline dir, copied back), where the per-story blank probability is low.
  # Bounded; fail loudly if a blank still persists.
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
  lp_run ""
fi
