#!/usr/bin/env bash
#
# Build and deploy the full labs.sti.care site to gh-pages.
#
# This is the deploy entrypoint for labs.sti.care. A prototype zip only ever holds
# the passport, so this is what you run: it assembles the composite the site is.
#   /                 a sti.care-styled landing page (generated)
#   /docs/<slug>.html the published design docs, rendered from labs/docs/*.md
#   /passport/        the prototype export (the newest, or given, *.zip)
# Which docs publish (and the landing copy) is set in labs/labs.config.json. The
# other markdown in labs/docs/ stays in the repo, unpublished.
#
# Usage:
#   deploy/build-labs.sh [zip] [--no-transpile] [--dry-run]
#
# The prototype source is resolved in order: an explicit zip arg, else the newest
# *.zip in the repo root, else the /passport already published on gh-pages. That
# last fallback means a docs- or landing-only redeploy needs no zip at all — every
# deploy republishes the passport, so the most recent export is reused as-is. JSX
# is pre-compiled by default (drops the in-browser Babel); --no-transpile serves
# the export verbatim (ignored when reusing the published passport, which is
# already built). --dry-run builds the tree and prints it without pushing.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/common.sh
. "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(repo_root "$SCRIPT_DIR")"
LABS_DIR="$REPO_ROOT/labs"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-gh-pages}"

ZIP=""
PREP_ARGS=()
PUB_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --transpile) PREP_ARGS+=(--transpile) ;;
    --no-transpile) PREP_ARGS+=(--no-transpile) ;;
    --dry-run) PUB_ARGS+=(--dry-run) ;;
    -h | --help)
      print_help "${BASH_SOURCE[0]}"
      exit 0
      ;;
    -*) die "Unknown flag: $1" ;;
    *)
      [ -z "$ZIP" ] || die "Only one zip at a time (got '$ZIP' and '$1')"
      ZIP="$1"
      ;;
  esac
  shift
done

[ -f "$LABS_DIR/labs.config.json" ] || die "Missing $LABS_DIR/labs.config.json"

# The markdown renderer needs `marked`. Auto-install once if it isn't resolvable
# (same spirit as napkin-build.sh fetching esbuild via npx).
if ! node -e "import('marked')" >/dev/null 2>&1; then
  log "Installing the 'marked' markdown renderer ..."
  (cd "$REPO_ROOT" && npm install --silent) || die "npm install failed (needed for 'marked')."
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# 1. Prototype -> /passport. Resolve the source in priority order:
#      a) an explicit zip arg, b) the newest *.zip in the repo root, else
#      c) reuse the /passport already published on $DEPLOY_BRANCH. Every deploy
#         republishes the passport there, so the most recent export is always
#         available — a docs- or landing-only redeploy needs no zip.
PASSPORT="$STAGE/passport"
ZIP_RESOLVED="${ZIP:-$(find_latest_zip "$REPO_ROOT")}"

if [ -n "$ZIP_RESOLVED" ]; then
  log "Preparing prototype into /passport ..."  # (prepare.sh clears its own --out)
  "$SCRIPT_DIR/prepare.sh" "$ZIP_RESOLVED" --out "$PASSPORT" \
    ${PREP_ARGS[@]+"${PREP_ARGS[@]}"} >/dev/null

  # Strip the internal "Edition B" period name from the export so nothing user- or
  # source-visible leaks it: the page title, the `appB/` code path, and any comments
  # or copy. A re-export under a neutral name is the clean long-term fix; this keeps
  # every published build clean meanwhile.
  if [ -d "$PASSPORT" ]; then
    # Rename the `appB/` code path to a neutral `app/` and fix every reference.
    if [ -d "$PASSPORT/appB" ]; then
      mv "$PASSPORT/appB" "$PASSPORT/app"
      grep -rlF 'appB/' "$PASSPORT" | while IFS= read -r f; do
        tmp="$(mktemp)" && sed 's#appB/#app/#g' "$f" >"$tmp" && mv "$tmp" "$f"
      done
      log "Renamed prototype 'appB/' → 'app/'."
    fi
    # Drop the "Edition B" name from any text (title, comments, copy).
    if grep -rlF 'Edition B' "$PASSPORT" >/dev/null 2>&1; then
      grep -rlF 'Edition B' "$PASSPORT" | while IFS= read -r f; do
        tmp="$(mktemp)" &&
          sed -E 's/ ?\(Edition B\)//g; s/ ?(—|-) ?Edition B//g; s/ ?Edition B//g' "$f" >"$tmp" &&
          mv "$tmp" "$f"
      done
      log "Scrubbed 'Edition B' from the prototype."
    fi
  fi
else
  # No zip anywhere: reuse the last published passport from $DEPLOY_BRANCH. It was
  # already prepared and scrubbed on its way up, so it ships back out as-is.
  ORIGIN_URL="$(git -C "$REPO_ROOT" remote get-url origin)"
  log "No prototype zip given; reusing /passport from $DEPLOY_BRANCH ..."
  git -C "$REPO_ROOT" fetch --quiet --depth=1 "$ORIGIN_URL" "$DEPLOY_BRANCH" \
    || die "Couldn't fetch $DEPLOY_BRANCH to reuse its /passport. Pass a prototype zip instead."
  git -C "$REPO_ROOT" ls-tree --name-only FETCH_HEAD passport | grep -q . \
    || die "No /passport on $DEPLOY_BRANCH yet — deploy once with a prototype zip first."
  git -C "$REPO_ROOT" archive FETCH_HEAD passport | tar -x -C "$STAGE"
  log "Reused $(find "$PASSPORT" -type f | wc -l | tr -d ' ') files from the last published /passport."
fi

# 2. Landing + docs, rendered from the repo.
log "Rendering landing + docs ..."
node "$LABS_DIR/render.mjs" --out "$STAGE"

# 3. Shared assets.
cp "$LABS_DIR/labs.css" "$STAGE/labs.css"
cp "$LABS_DIR/favicon.svg" "$STAGE/favicon.svg"

# 4. Ship it. 404 falls back to the landing page (publish.sh copies index.html).
"$SCRIPT_DIR/publish.sh" "$STAGE" ${PUB_ARGS[@]+"${PUB_ARGS[@]}"}
