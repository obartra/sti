#!/usr/bin/env bash
#
# Pre-transpile a napkin-style export in place so it no longer needs the ~3MB
# in-browser Babel compiler.
#
# Deterministic, 1:1, no bundling: each app/*.jsx is transpiled to a minified
# app/*.js with esbuild's classic JSX transform (the same React.createElement
# output Babel produces), the entry's `<script type="text/babel" src=...jsx>`
# tags become plain `<script src=...js>`, and the Babel-standalone `<script>` is
# removed. React/ReactDOM stay exactly as they were (loaded as globals), and the
# load order and window.* sharing are untouched.
#
# Usage: deploy/napkin-build.sh [site-dir]   (default: current dir)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/common.sh
. "$SCRIPT_DIR/common.sh"

SITE="${1:-.}"
[ -d "$SITE" ] || die "Not a directory: $SITE"
SITE="$(cd "$SITE" && pwd)"
HTML="$SITE/index.html"
[ -f "$HTML" ] || die "No index.html in $SITE (run prepare.sh first)."

# Only act on actual napkin exports (entry loads JSX via text/babel). This keeps
# the transpile a safe no-op when it runs by default on some other kind of zip.
if ! grep -q 'type="text/babel"' "$HTML"; then
  log "No text/babel tags in index.html; not a napkin export, skipping transpile."
  exit 0
fi

# Collect the JSX files (current shell, so the array survives the loop).
jsx=()
while IFS= read -r f; do jsx+=("$f"); done < <(find "$SITE" -type f -name '*.jsx')
if [ "${#jsx[@]}" -eq 0 ]; then
  log "No .jsx files found; nothing to transpile."
  exit 0
fi

# One esbuild pass: each app/x.jsx -> app/x.js (classic transform, minified).
# No --bundle, so nothing is resolved, reordered, or tree-shaken.
npx --yes esbuild "${jsx[@]}" \
  --outbase="$SITE" --outdir="$SITE" --jsx=transform --minify \
  >/dev/null 2>&1 || die "esbuild failed to transpile one or more .jsx files."
for f in "${jsx[@]}"; do rm -f "$f"; done
log "Transpiled ${#jsx[@]} .jsx file(s) to minified .js."

# Rewrite the entry: text/babel jsx tags -> plain js script tags, drop Babel.
tmp="$(mktemp)"
sed -E \
  -e 's/ type="text\/babel" src="([^"]+)\.jsx"/ src="\1.js"/g' \
  -e '/@babel\/standalone/d' \
  "$HTML" >"$tmp"
mv "$tmp" "$HTML"

# Fail loudly if the export's tag shape drifted and something slipped through.
if grep -q 'text/babel' "$HTML"; then
  die "index.html still has text/babel tags after rewrite (unexpected tag format)."
fi
if grep -q '\.jsx"' "$HTML"; then
  die "index.html still references .jsx after rewrite (unexpected tag format)."
fi
log "Rewrote index.html: JSX tags now load .js; Babel-standalone removed."
