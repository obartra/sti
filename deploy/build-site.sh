#!/usr/bin/env bash
# Assemble the sti.care publish dir (dist/): the passport app at the root and
# Storybook at /design. Run by Netlify on every deploy (see netlify.toml). The
# /promises page is served by the app itself (the in-app, test-backed guarantees),
# not a separate static report.
set -euo pipefail
cd "$(dirname "$0")/.."

# One install, then build the app and Storybook from the passport package.
( cd passport && npm ci && npm run build && npm run build-storybook )

rm -rf dist
cp -r passport/dist dist               # the app at the root
cp -r passport/storybook-static dist/design

echo "site: assembled dist/ (app + /design)"
