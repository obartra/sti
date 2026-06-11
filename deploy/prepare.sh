#!/usr/bin/env bash
#
# Prepare a prototype zip into a clean, host-agnostic site directory.
#
# Resolves the zip (first arg, or the newest *.zip in the repo root), extracts
# it, finds the site root (promoting a lone "<Title>.html" to index.html),
# removes macOS cruft and design-process files, optionally runs a build, then
# prints the prepared directory's path on stdout. Everything else goes to
# stderr, so:  SITE="$(deploy/prepare.sh)"  captures just the path.
#
# Host-specific files (CNAME, .nojekyll, 404.html) are NOT added here; publish.sh
# adds those when it ships the directory to gh-pages.
#
# Usage:
#   deploy/prepare.sh [zip] [--out DIR] [--exclude PATTERN]...
#                     [--no-default-excludes] [--no-transpile] [--build "CMD"]
#
# Default excludes (design-process files common in napkin-style exports):
#   docs scraps uploads .thumbnail
# Pass --no-default-excludes to keep them, or --exclude to drop more.
#
# JSX is pre-compiled by default (napkin-build.sh: drops the ~3MB in-browser
# Babel compiler; deterministic, see that script; a no-op on non-napkin zips).
# Pass --no-transpile to serve the export verbatim. --build runs an arbitrary
# CMD inside the site dir for any other build need.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/common.sh
. "$SCRIPT_DIR/common.sh"

DEFAULT_EXCLUDES=(docs scraps uploads .thumbnail)

ZIP=""
OUT=""
BUILD_CMD=""
USE_DEFAULTS=1
TRANSPILE=1
EXCLUDES=()

while [ $# -gt 0 ]; do
  case "$1" in
    --out)
      shift
      [ $# -gt 0 ] || die "--out needs a DIR"
      OUT="$1"
      ;;
    --out=*) OUT="${1#--out=}" ;;
    --exclude)
      shift
      [ $# -gt 0 ] || die "--exclude needs a PATTERN"
      EXCLUDES+=("$1")
      ;;
    --exclude=*) EXCLUDES+=("${1#--exclude=}") ;;
    --no-default-excludes) USE_DEFAULTS=0 ;;
    --transpile) TRANSPILE=1 ;;
    --no-transpile) TRANSPILE=0 ;;
    --build)
      shift
      [ $# -gt 0 ] || die "--build needs a CMD"
      BUILD_CMD="$1"
      ;;
    --build=*) BUILD_CMD="${1#--build=}" ;;
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

REPO_ROOT="$(repo_root "$SCRIPT_DIR")"

if [ -z "$ZIP" ]; then
  ZIP="$(find_latest_zip "$REPO_ROOT")"
  [ -n "$ZIP" ] || die "No zip given and no *.zip found in $REPO_ROOT"
  log "Using newest zip: ${ZIP#"$REPO_ROOT"/}"
fi
[ -f "$ZIP" ] || die "Zip not found: $ZIP"
unzip -tqq "$ZIP" >/dev/null 2>&1 || die "Not a readable zip archive: $ZIP"

# Stage into a persistent dir so publish.sh can run as a separate step.
if [ -n "$OUT" ]; then
  mkdir -p "$OUT"
  EXTRACT="$(cd "$OUT" && pwd)"
  find "$EXTRACT" -mindepth 1 -delete 2>/dev/null || true
else
  EXTRACT="$(mktemp -d)"
fi

log "Extracting $(basename "$ZIP") ..."
unzip -q "$ZIP" -d "$EXTRACT"

find "$EXTRACT" -name '__MACOSX' -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$EXTRACT" -name '.DS_Store' -type f -delete 2>/dev/null || true

# Site root = shallowest dir holding index.html. With no index.html but a single
# HTML file (exports often name the entry "<Title>.html"), promote it.
INDEX="$(find "$EXTRACT" -name index.html -type f \
  | awk -F/ '{print NF, $0}' | sort -n | head -1 | cut -d' ' -f2-)"
if [ -z "$INDEX" ]; then
  HTML_LIST="$(find "$EXTRACT" -type f \( -iname '*.html' -o -iname '*.htm' \) ! -name '404.html')"
  HTML_COUNT="$(printf '%s\n' "$HTML_LIST" | grep -c . || true)"
  if [ "$HTML_COUNT" -eq 0 ]; then
    die "No HTML entry found anywhere in the zip; nothing to prepare."
  elif [ "$HTML_COUNT" -gt 1 ]; then
    log "No index.html, and multiple HTML files exist; can't pick the entry:"
    printf '%s\n' "$HTML_LIST" | sed "s#^$EXTRACT/#  #" >&2
    die "Rename the intended entry to index.html in the zip, then retry."
  fi
  INDEX="$(dirname "$HTML_LIST")/index.html"
  mv "$HTML_LIST" "$INDEX"
  log "Promoted '$(basename "$HTML_LIST")' -> index.html (no index.html in the zip)."
fi
SITE="$(dirname "$INDEX")"
if [ "$SITE" = "$EXTRACT" ]; then log "Site root: (zip root)"; else log "Site root: ${SITE#"$EXTRACT"/}"; fi

# Build the effective exclude list, then drop matching paths under the site root.
EX=()
[ "$USE_DEFAULTS" -eq 1 ] && EX+=("${DEFAULT_EXCLUDES[@]}")
[ "${#EXCLUDES[@]}" -gt 0 ] && EX+=("${EXCLUDES[@]}")
if [ "${#EX[@]}" -gt 0 ]; then
  shopt -s nullglob dotglob
  for pat in "${EX[@]}"; do
    for match in "$SITE"/$pat; do
      [ -e "$match" ] || continue
      rm -rf "$match"
      log "Excluded: ${match#"$SITE"/}"
    done
  done
  shopt -u nullglob dotglob
fi

# Pre-transpile JSX so the export drops the in-browser Babel compiler.
if [ "$TRANSPILE" -eq 1 ]; then
  "$SCRIPT_DIR/napkin-build.sh" "$SITE"
fi

# Optional build step (none needed for runtime-Babel napkin exports).
if [ -n "$BUILD_CMD" ]; then
  log "Building: $BUILD_CMD"
  (cd "$SITE" && eval "$BUILD_CMD" >&2)
fi

log "Prepared $(find "$SITE" -type f | wc -l | tr -d ' ') files at:"
printf '%s\n' "$SITE"
