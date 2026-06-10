#!/usr/bin/env bash
#
# Deploy a prototype zip to the GitHub Pages (gh-pages) branch.
#
# What it does, given a single zip:
#   1. Extracts it to a temp dir and finds the site root: the folder that holds
#      index.html (whether or not the zip wraps the files in a folder). If there
#      is no index.html but exactly one HTML file (design-tool exports often name
#      the entry "<Title>.html"), that file is promoted to index.html.
#   2. Strips macOS zip cruft (__MACOSX, .DS_Store) and any --exclude paths.
#   3. Adds the custom-domain CNAME, a .nojekyll marker, and an SPA 404 fallback.
#   4. Force-pushes those files to the gh-pages branch as a single fresh commit,
#      so each deploy fully replaces the branch and its history is disregarded.
#
# It never touches your working tree or any other branch: the publish folder is
# turned into its own throwaway git repo and pushed straight to origin.
#
# Usage:
#   deploy/deploy-gh-pages.sh <path-to-zip>
#   deploy/deploy-gh-pages.sh <zip> --exclude docs --exclude uploads
#   deploy/deploy-gh-pages.sh <zip> --dry-run            # build, don't push
#   deploy/deploy-gh-pages.sh <zip> --no-spa-fallback
#
# --exclude PATTERN (repeatable) removes paths relative to the site root (glob
# allowed) before publishing, e.g. design-process folders in an export. The
# custom domain is read from deploy/CNAME (one host per deploy).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-gh-pages}"

ZIP=""
DRY_RUN=0
SPA_FALLBACK=1
EXCLUDES=()

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-spa-fallback) SPA_FALLBACK=0 ;;
    --exclude)
      shift
      [ $# -gt 0 ] || {
        echo "--exclude needs a PATTERN" >&2
        exit 2
      }
      EXCLUDES+=("$1")
      ;;
    --exclude=*) EXCLUDES+=("${1#--exclude=}") ;;
    -h | --help)
      awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    -*)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
    *)
      if [ -n "$ZIP" ]; then
        echo "Only one zip can be deployed at a time (got '$ZIP' and '$1')." >&2
        exit 2
      fi
      ZIP="$1"
      ;;
  esac
  shift
done

if [ -z "$ZIP" ]; then
  echo "Usage: deploy/deploy-gh-pages.sh <path-to-zip> [--exclude PATTERN]... [--dry-run] [--no-spa-fallback]" >&2
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

# Site root = the shallowest directory containing an index.html. If there is no
# index.html but exactly one HTML file (design-tool exports often name the entry
# "<Title>.html"), promote it so Pages serves it as the directory index.
INDEX="$(find "$EXTRACT" -name index.html -type f \
  | awk -F/ '{print NF, $0}' | sort -n | head -1 | cut -d' ' -f2-)"
if [ -z "$INDEX" ]; then
  HTML_LIST="$(find "$EXTRACT" -type f \( -iname '*.html' -o -iname '*.htm' \) ! -name '404.html')"
  HTML_COUNT="$(printf '%s\n' "$HTML_LIST" | grep -c . || true)"
  if [ "$HTML_COUNT" -eq 0 ]; then
    echo "No HTML entry found anywhere in the zip; nothing to publish." >&2
    exit 1
  elif [ "$HTML_COUNT" -gt 1 ]; then
    echo "No index.html, and multiple HTML files exist; can't pick the entry:" >&2
    printf '%s\n' "$HTML_LIST" | sed "s#^$EXTRACT/#  #" >&2
    echo "Rename the intended entry to index.html in the zip, then retry." >&2
    exit 1
  fi
  INDEX="$(dirname "$HTML_LIST")/index.html"
  cp "$HTML_LIST" "$INDEX"
  echo "Promoted '$(basename "$HTML_LIST")' -> index.html (no index.html in the zip)."
fi
PUBLISH_DIR="$(dirname "$INDEX")"
if [ "$PUBLISH_DIR" = "$EXTRACT" ]; then REL="(zip root)"; else REL="${PUBLISH_DIR#"$EXTRACT"/}"; fi
echo "Publish root: $REL"

# Drop any --exclude paths (relative to the site root) before publishing.
if [ "${#EXCLUDES[@]}" -gt 0 ]; then
  shopt -s nullglob dotglob
  for pat in "${EXCLUDES[@]}"; do
    hit=0
    for match in "$PUBLISH_DIR"/$pat; do
      [ -e "$match" ] || continue
      rm -rf "$match"
      echo "Excluded: ${match#"$PUBLISH_DIR"/}"
      hit=1
    done
    [ "$hit" -eq 1 ] || echo "Exclude '$pat' matched nothing."
  done
  shopt -u nullglob dotglob
fi

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
