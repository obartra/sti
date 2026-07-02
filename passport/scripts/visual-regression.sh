#!/usr/bin/env bash
# Run lost-pixel visual regression in the pinned lost-pixel Docker image
# (copied from centaur). Docker keeps rendering byte-stable across macOS dev
# and ubuntu-latest CI: both invoke the same image, so committed baselines
# match. Running lost-pixel directly via npm produces different pixels on macOS
# and breaks the gate.
#
# Usage:
#   scripts/visual-regression.sh                  # diff against baselines, exit 1 on mismatch
#   scripts/visual-regression.sh --update         # write/replace baselines, then prune orphans
#   scripts/visual-regression.sh --shard I --of N # diff only shard I of N (1-based): CI fan-out
#   LP_BASELINE_DIR=dir scripts/visual-regression.sh --update --shard I --of N
#                                                 # regenerate only slice I of N into dir
#
# Sharding splits the (expensive) capture across N parallel CI jobs: each shoots
# a deterministic 1/N slice of the story corpus. On the diff gate a shard writes
# no baselines (so it cannot prune) and check-baselines still validates the full
# corpus shape in every shard (jq-only, cheap). With --update a shard REGENERATES
# its slice, and because a filtered lost-pixel update prunes every baseline
# outside its page set, a sharded update refuses to run unless LP_BASELINE_DIR
# points it at a throwaway slice dir (repo-relative: Docker mounts $PWD). The CI
# collector job assembles the slices into visual-baselines/ and prunes there.
#
# Prereqs: Docker daemon running. On Apple Silicon, Rosetta 2 (preflighted).

set -euo pipefail
cd "$(dirname "$0")/.."

MODE=
SHARD=
SHARDS=
while [[ $# -gt 0 ]]; do
  case "$1" in
    --update) MODE=update ;;
    --shard) SHARD="${2:-}"; shift ;;
    --of) SHARDS="${2:-}"; shift ;;
    *) echo "::error::unknown argument: $1"; exit 2 ;;
  esac
  shift
done

if [[ -n "$MODE" && ( -n "$SHARD" || -n "$SHARDS" ) && -z "${LP_BASELINE_DIR:-}" ]]; then
  echo "::error::a sharded --update must write to a throwaway LP_BASELINE_DIR, never visual-baselines/ (a filtered update prunes everything outside its slice)"; exit 2
fi
if { [[ -n "$SHARD" ]] && [[ -z "$SHARDS" ]]; } ||
   { [[ -z "$SHARD" ]] && [[ -n "$SHARDS" ]]; }; then
  echo "::error::--shard and --of must be given together"; exit 2
fi

# The comma-separated story ids for shard I of N: the filtered corpus (same
# filter as check-baselines.sh / lostpixel.config.cjs), partitioned round-robin
# so each shard gets a balanced, deterministic slice.
shard_ids() {
  jq -r '.entries | to_entries[]
    | select(.value.type=="story")
    | select(.value.title | (startswith("Design System") or startswith("PWA/Install screenshots")) | not)
    | .key' storybook-static/index.json \
    | sort -u \
    | awk -v i="$1" -v n="$2" '((NR - 1) % n) == (i - 1)' \
    | paste -sd, -
}

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
# render (every real baseline is comfortably larger).
BLANK_FLOOR=10000

# Re-shoot a single story id and copy it back only if it came out non-blank. The
# capture targets a throwaway baseline dir because a filtered lost-pixel run
# prunes every baseline outside its page set; we never point that at the real
# dir. Returns 0 if the story is now non-blank in $DEST.
recapture_one() {
  local id="$1"
  local tmp=".lostpixel/recapture"
  rm -rf "$tmp"; mkdir -p "$tmp"
  LP_BASELINE_DIR="$tmp" lp_run "$id" update || true
  local shot="$tmp/${id}.png"
  if [[ -f "$shot" ]] && [[ -z "$(find "$shot" -size "-${BLANK_FLOOR}c")" ]]; then
    cp "$shot" "$DEST/${id}.png"
  fi
  rm -rf "$tmp"
  [[ -z "$(find "$DEST/${id}.png" -size "-${BLANK_FLOOR}c" 2>/dev/null)" ]]
}

if [[ "$MODE" == "update" ]]; then
  # Where the regenerated baselines land: the real dir, or the throwaway slice
  # dir a sharded (or otherwise redirected) update was pointed at.
  DEST="${LP_BASELINE_DIR:-visual-baselines}"
  ONLY=""
  if [[ -n "$SHARDS" ]]; then
    mkdir -p "$DEST"
    ONLY="$(shard_ids "$SHARD" "$SHARDS")"
    if [[ -z "$ONLY" ]]; then
      echo "→ Shard ${SHARD}/${SHARDS} has no stories; nothing to regenerate."
      exit 0
    fi
    count="$(printf '%s' "$ONLY" | tr ',' '\n' | grep -c .)"
    echo "→ Shard ${SHARD}/${SHARDS}: regenerating ${count} baselines into ${DEST}"
  fi
  # --update exits 1 whenever it writes baselines; PNGs are on disk by then, so
  # tolerate it and let check-baselines.sh --prune be the real gate.
  lp_run "$ONLY" update || true
  # Prune/shape-check only a full update of the real dir: a slice dir holds
  # exactly its slice, and the CI collector prunes the assembled union.
  if [[ "$DEST" == "visual-baselines" ]]; then
    ./scripts/check-baselines.sh --prune
  fi
  # Capture-determinism guard. A heavy story very occasionally renders a near-
  # empty (blank) PNG under headless capture even with the mount-paint signal.
  # Re-running the whole suite just relocates the blank to a different random
  # story, so re-shoot ONLY each blank story in isolation (into a throwaway
  # baseline dir, copied back), where the per-story blank probability is low.
  # Bounded; fail loudly if a blank still persists.
  for attempt in 1 2 3 4 5; do
    blanks="$(find "$DEST" -name '*.png' -size "-${BLANK_FLOOR}c")"
    [[ -z "$blanks" ]] && break
    echo "→ Re-capturing blank shot(s) in isolation (attempt ${attempt}):"
    for f in $blanks; do
      id="$(basename "$f" .png)"
      echo "    ${id}"
      recapture_one "$id" || true
    done
  done
  blanks="$(find "$DEST" -name '*.png' -size "-${BLANK_FLOOR}c")"
  if [[ -n "$blanks" ]]; then
    echo "::error::Blank baselines persist after retries:"
    printf '  %s\n' $blanks
    exit 1
  fi
else
  # Diff/gate path. Capture + diff once, then self-heal capture artifacts. Under
  # concurrency a heavy story can come out blank OR partially painted; neither is
  # reliably told apart from a real change by size, and flakynessRetries can't
  # catch a consistently-bad shot. So re-shoot each differing story IN ISOLATION
  # (one page, no contention, a complete render): a capture artifact then matches
  # the baseline; a genuine change still differs. A filtered test run writes no
  # baselines, so it cannot prune.
  ONLY=""
  if [[ -n "$SHARDS" ]]; then
    ONLY="$(shard_ids "$SHARD" "$SHARDS")"
    if [[ -z "$ONLY" ]]; then
      echo "→ Shard ${SHARD}/${SHARDS} has no stories; nothing to diff."
      exit 0
    fi
    count="$(printf '%s' "$ONLY" | tr ',' '\n' | grep -c .)"
    echo "→ Shard ${SHARD}/${SHARDS}: diffing ${count} stories"
  fi
  lp_run "$ONLY" || true

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
    echo "::error::${#diffs[@]} stories differ (intended change? use screenshot:update):"
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
