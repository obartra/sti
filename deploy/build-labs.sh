#!/usr/bin/env bash
#
# Build and deploy the full labs.sti.care site to gh-pages.
#
# Unlike deploy.sh (which ships a prototype zip as the whole site), this assembles
# a composite:
#   /                 a sti.care-styled landing page (generated)
#   /docs/<slug>.html the published design docs, rendered from labs/docs/*.md
#   /passport/        the prototype export (the newest, or given, *.zip)
# Which docs publish (and the landing copy) is set in labs/labs.config.json. The
# other markdown in labs/docs/ stays in the repo, unpublished.
#
# Usage:
#   deploy/build-labs.sh [zip] [--no-transpile] [--dry-run]
#
# With no zip, the newest *.zip in the repo root is used for the prototype. JSX is
# pre-compiled by default (drops the in-browser Babel); --no-transpile serves the
# export verbatim. --dry-run builds the tree and prints it without pushing.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/common.sh
. "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(repo_root "$SCRIPT_DIR")"
LABS_DIR="$REPO_ROOT/labs"

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

# 1. Prototype -> /passport (prepare.sh clears only its own --out subdir).
log "Preparing prototype into /passport ..."
"$SCRIPT_DIR/prepare.sh" ${ZIP:+"$ZIP"} --out "$STAGE/passport" \
  ${PREP_ARGS[@]+"${PREP_ARGS[@]}"} >/dev/null

# "Edition B" is the internal name for this passport period; keep it off the
# user-visible page title. (It also lingers in the export's code comments, which
# aren't user-visible; a re-export with the new period name is the clean fix.)
PROTO_INDEX="$STAGE/passport/index.html"
if [ -f "$PROTO_INDEX" ] && grep -q 'Edition B' "$PROTO_INDEX"; then
  tmp="$(mktemp)"
  sed -E 's/ ?(—|-) ?Edition B//g; s/ Edition B//g' "$PROTO_INDEX" >"$tmp"
  mv "$tmp" "$PROTO_INDEX"
  log "Scrubbed 'Edition B' from the prototype page title."
fi

# 2. Landing + docs, rendered from the repo.
log "Rendering landing + docs ..."
node "$LABS_DIR/render.mjs" --out "$STAGE"

# 3. Shared assets.
cp "$LABS_DIR/labs.css" "$STAGE/labs.css"
cp "$REPO_ROOT/public/favicon.svg" "$STAGE/favicon.svg"

# 4. Ship it. 404 falls back to the landing page (publish.sh copies index.html).
"$SCRIPT_DIR/publish.sh" "$STAGE" ${PUB_ARGS[@]+"${PUB_ARGS[@]}"}
