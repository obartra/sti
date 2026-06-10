#!/usr/bin/env bash
#
# Deploy a prototype zip to the GitHub Pages (gh-pages) branch.
#
# What it does, given a single zip:
#   1. Extracts it to a temp dir and finds the folder that holds index.html
#      (works whether the zip wraps the files in a folder or not).
#   2. Strips macOS zip cruft (__MACOSX, .DS_Store).
#   3. Adds the custom-domain CNAME, a .nojekyll marker, and an SPA 404 fallback.
#   4. Force-pushes those files to the gh-pages branch as a single fresh commit,
#      so each deploy fully replaces the branch and its history is disregarded.
#
# It never touches your working tree or any other branch: the publish folder is
# turned into its own throwaway git repo and pushed straight to origin.
#
# Usage:
#   deploy/deploy-gh-pages.sh <path-to-zip>
#   deploy/deploy-gh-pages.sh <path-to-zip> --dry-run        # build, don't push
#   deploy/deploy-gh-pages.sh <path-to-zip> --no-spa-fallback
#
# The custom domain is read from deploy/CNAME (one host per deploy).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-gh-pages}"

ZIP=""
DRY_RUN=0
SPA_FALLBACK=1

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-spa-fallback) SPA_FALLBACK=0 ;;
    -h | --help)
      sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "Unknown flag: $arg" >&2
      exit 2
      ;;
    *)
      if [ -n "$ZIP" ]; then
        echo "Only one zip can be deployed at a time (got '$ZIP' and '$arg')." >&2
        exit 2
      fi
      ZIP="$arg"
      ;;
  esac
done

if [ -z "$ZIP" ]; then
  echo "Usage: deploy/deploy-gh-pages.sh <path-to-zip> [--dry-run] [--no-spa-fallback]" >&2
  exit 2
fi
if [ ! -f "$ZIP" ]; then
  echo "Zip not found: $ZIP" >&2
  exit 1
fi
if ! unzip -tqq "$ZIP" >/dev/null 2>&1; then
  echo "Not a readable zip archive: $ZIP" >&2
  exit 1
fi

REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
ORIGIN_URL="$(git -C "$REPO_ROOT" remote get-url origin)"
# Normalize origin (git@github.com:owner/repo.git or https) to a web URL.
WEB_URL="$(printf '%s' "$ORIGIN_URL" \
  | sed -E -e 's#^git@github\.com:#https://github.com/#' -e 's#\.git$##')"

CNAME_FILE="$SCRIPT_DIR/CNAME"
if [ ! -s "$CNAME_FILE" ]; then
  echo "Missing or empty $CNAME_FILE (the custom domain to serve from)." >&2
  exit 1
fi
DOMAIN="$(grep -m1 -v '^[[:space:]]*$' "$CNAME_FILE" | tr -d '[:space:]')"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
EXTRACT="$WORK/extract"
mkdir -p "$EXTRACT"

echo "Extracting $(basename "$ZIP") ..."
unzip -q "$ZIP" -d "$EXTRACT"

# Drop macOS zip artifacts before locating the site root.
find "$EXTRACT" -name '__MACOSX' -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$EXTRACT" -name '.DS_Store' -type f -delete 2>/dev/null || true

# Site root = the shallowest directory containing an index.html.
INDEX="$(find "$EXTRACT" -name index.html -type f \
  | awk -F/ '{print NF, $0}' | sort -n | head -1 | cut -d' ' -f2-)"
if [ -z "$INDEX" ]; then
  echo "No index.html found anywhere in the zip; nothing to publish." >&2
  exit 1
fi
PUBLISH_DIR="$(dirname "$INDEX")"
echo "Publish root: ${PUBLISH_DIR#"$EXTRACT"/}  (index.html found)"

# Custom domain + disable Jekyll (so paths like /src and _underscore files survive).
printf '%s\n' "$DOMAIN" >"$PUBLISH_DIR/CNAME"
touch "$PUBLISH_DIR/.nojekyll"

# SPA deep-link fallback: GitHub Pages has no rewrite engine, so a direct hit on
# a client-side route (e.g. /hiv) would 404. Serving the app shell as 404.html
# lets the in-page router take over. Skip with --no-spa-fallback for multi-page
# sites that ship their own 404.html.
if [ "$SPA_FALLBACK" -eq 1 ] && [ ! -f "$PUBLISH_DIR/404.html" ]; then
  cp "$PUBLISH_DIR/index.html" "$PUBLISH_DIR/404.html"
  echo "Added 404.html (SPA fallback, copy of index.html)."
fi

FILE_COUNT="$(find "$PUBLISH_DIR" -type f | wc -l | tr -d ' ')"
echo "Prepared $FILE_COUNT files for $DOMAIN."

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "Dry run: not pushing. Inspect the prepared tree at:"
  echo "  $PUBLISH_DIR"
  echo "(this folder is deleted when the script exits; copy it out if you need it.)"
  trap - EXIT
  echo "Left in place for inspection: $PUBLISH_DIR"
  exit 0
fi

# Turn the publish folder into a throwaway repo and force-push it as gh-pages.
# A fresh single commit each time means the prior gh-pages history is discarded.
MSG="Deploy $(basename "$ZIP") at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
git -C "$PUBLISH_DIR" init -q
git -C "$PUBLISH_DIR" add -A
git -C "$PUBLISH_DIR" \
  -c user.name="lab.sti.care deploy" \
  -c user.email="deploy@users.noreply.github.com" \
  commit -q -m "$MSG"

echo "Force-pushing to $DEPLOY_BRANCH (replacing any prior history) ..."
git -C "$PUBLISH_DIR" push --force "$ORIGIN_URL" "HEAD:$DEPLOY_BRANCH"

echo
echo "Deployed. Live (after DNS + cert) at: https://$DOMAIN/"
echo "Branch view: $WEB_URL/tree/$DEPLOY_BRANCH"
