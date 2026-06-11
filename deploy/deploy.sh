#!/usr/bin/env bash
#
# One-shot deploy: prepare the newest (or given) zip, then publish it to
# gh-pages. A thin wrapper over prepare.sh + publish.sh.
#
# Use the two scripts directly if you want to inspect or tweak the staged site
# between steps:  SITE="$(deploy/prepare.sh)" ; deploy/publish.sh "$SITE"
#
# Usage:
#   deploy/deploy.sh [zip] [--exclude PATTERN]... [--no-default-excludes]
#                    [--no-transpile] [--build "CMD"] [--no-spa-fallback] [--dry-run]
#
# With no zip, the newest *.zip in the repo root is used. Design-process files
# (docs, scraps, uploads, .thumbnail) are excluded by default, and the JSX is
# pre-compiled by default (drops the in-browser Babel). Pass --no-transpile to
# serve the export verbatim.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/common.sh
. "$SCRIPT_DIR/common.sh"

ZIP=""
PREP_ARGS=()
PUB_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --exclude)
      shift
      [ $# -gt 0 ] || die "--exclude needs a PATTERN"
      PREP_ARGS+=(--exclude "$1")
      ;;
    --exclude=*) PREP_ARGS+=("$1") ;;
    --no-default-excludes) PREP_ARGS+=(--no-default-excludes) ;;
    --transpile) PREP_ARGS+=(--transpile) ;;
    --no-transpile) PREP_ARGS+=(--no-transpile) ;;
    --build)
      shift
      [ $# -gt 0 ] || die "--build needs a CMD"
      PREP_ARGS+=(--build "$1")
      ;;
    --build=*) PREP_ARGS+=("$1") ;;
    --no-spa-fallback) PUB_ARGS+=(--no-spa-fallback) ;;
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

# Stage into a temp dir that we clean up after publishing.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

SITE="$("$SCRIPT_DIR/prepare.sh" ${ZIP:+"$ZIP"} --out "$STAGE" ${PREP_ARGS[@]+"${PREP_ARGS[@]}"})"
"$SCRIPT_DIR/publish.sh" "$SITE" ${PUB_ARGS[@]+"${PUB_ARGS[@]}"}
