#!/usr/bin/env bash
#
# Publish a prepared site directory to the gh-pages branch (force, no history).
#
# Works on a copy of the directory, adds the custom-domain CNAME (from
# deploy/CNAME), a .nojekyll marker, and a 404.html SPA fallback, then
# force-pushes it to gh-pages as a single fresh commit so the prior history is
# discarded. The input directory and your working tree are left untouched.
#
# Usage:
#   deploy/publish.sh <site-dir> [--no-spa-fallback] [--dry-run]
#
# Pair with prepare.sh:
#   SITE="$(deploy/prepare.sh)" && deploy/publish.sh "$SITE"

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/common.sh
. "$SCRIPT_DIR/common.sh"

DEPLOY_BRANCH="${DEPLOY_BRANCH:-gh-pages}"
SITE=""
SPA_FALLBACK=1
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --no-spa-fallback) SPA_FALLBACK=0 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      print_help "${BASH_SOURCE[0]}"
      exit 0
      ;;
    -*) die "Unknown flag: $1" ;;
    *)
      [ -z "$SITE" ] || die "Only one directory at a time (got '$SITE' and '$1')"
      SITE="$1"
      ;;
  esac
  shift
done

[ -n "$SITE" ] || die "Usage: deploy/publish.sh <site-dir> [--no-spa-fallback] [--dry-run]"
[ -d "$SITE" ] || die "Not a directory: $SITE"
[ -f "$SITE/index.html" ] || die "No index.html in $SITE (run prepare.sh first)."

CNAME_FILE="$SCRIPT_DIR/CNAME"
[ -s "$CNAME_FILE" ] || die "Missing or empty $CNAME_FILE (the custom domain to serve from)."
DOMAIN="$(grep -m1 -v '^[[:space:]]*$' "$CNAME_FILE" | tr -d '[:space:]')"

REPO_ROOT="$(repo_root "$SCRIPT_DIR")"
ORIGIN_URL="$(git -C "$REPO_ROOT" remote get-url origin)"
WEB_URL="$(web_url "$ORIGIN_URL")"

# Operate on a copy so the input dir is never mutated (no stray .git, no CNAME).
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PUB="$WORK/site"
mkdir -p "$PUB"
cp -R "$SITE/." "$PUB/"
rm -rf "$PUB/.git"

printf '%s\n' "$DOMAIN" >"$PUB/CNAME"
touch "$PUB/.nojekyll"
if [ "$SPA_FALLBACK" -eq 1 ] && [ ! -f "$PUB/404.html" ]; then
  cp "$PUB/index.html" "$PUB/404.html"
  log "Added 404.html (SPA fallback, copy of index.html)."
fi

COUNT="$(find "$PUB" -type f | wc -l | tr -d ' ')"
log "Publishing $COUNT files for $DOMAIN to $DEPLOY_BRANCH."

if [ "$DRY_RUN" -eq 1 ]; then
  log "Dry run: not pushing. Files that would be published:"
  (cd "$PUB" && find . -type f | sed 's#^\./#  #' | sort) >&2
  exit 0
fi

# One fresh root commit (no parent, so prior gh-pages history is discarded),
# force-pushed. Built with plumbing INSIDE this repo — using its object store and
# commit-signing config via an isolated index + work-tree — so signed-commit
# setups keep working while your checkout, index, and branches stay untouched.
# (A throwaway repo elsewhere can't reach the signing config, so we don't use one;
#  --force on the add means .gitignore/excludes never drop a published file.)
MSG="Deploy $DOMAIN at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
SIGN=""
[ "$(git -C "$REPO_ROOT" config --bool commit.gpgsign 2>/dev/null)" = "true" ] && SIGN="-S"
export GIT_DIR="$(git -C "$REPO_ROOT" rev-parse --absolute-git-dir)"
export GIT_WORK_TREE="$PUB"
export GIT_INDEX_FILE="$WORK/deploy-index"
git add --all --force
TREE="$(git write-tree)"
COMMIT="$(git commit-tree $SIGN "$TREE" -m "$MSG")"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
log "Force-pushing to $DEPLOY_BRANCH (replacing any prior history) ..."
git -C "$REPO_ROOT" push --force "$ORIGIN_URL" "$COMMIT:refs/heads/$DEPLOY_BRANCH"

log ""
log "Deployed. Live (after DNS + cert) at: https://$DOMAIN/"
log "Branch view: $WEB_URL/tree/$DEPLOY_BRANCH"
