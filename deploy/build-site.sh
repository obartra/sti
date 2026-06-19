#!/usr/bin/env bash
# Assemble the sti.care publish dir (dist/): the passport app at the root, plus
# the promises report at /promises and Storybook at /design. Run by Netlify on
# every deploy (see netlify.toml).
set -euo pipefail
cd "$(dirname "$0")/.."

# Tags so the report's version stamp reads as the release tag on a shallow CI
# checkout, not a bare sha.
git fetch --tags --force 2>/dev/null || true

# One install, then build the app and Storybook from the passport package.
( cd passport && npm ci && npm run build && npm run build-storybook )

rm -rf dist
cp -r passport/dist dist               # the app at the root
node deploy/build-promises.mjs         # writes dist/promises
cp -r passport/storybook-static dist/design

echo "site: assembled dist/ (app + /promises + /design)"
