#!/usr/bin/env bash
# Decide which top-level areas a pull request touches (passport, info, server)
# so CI can skip jobs whose area is untouched. Skipped required checks count as
# satisfied on GitHub, so gating happens per-job here rather than with
# workflow-level `paths:` filters (those would leave required checks pending
# forever).
#
# Fail-open by design: any doubt (not a PR, the compare API errored, the file
# list hit the API's cap, an unrecognized root path) marks every area changed,
# so a bug here can only waste minutes, never skip a real gate.
#
# Expects: GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_OUTPUT,
# and for pull_request events BASE_SHA / HEAD_SHA.

set -euo pipefail

all() {
  printf 'passport=true\ninfo=true\nserver=true\n' >>"$GITHUB_OUTPUT"
  echo "→ all areas run: $1"
  exit 0
}

if [[ "${GITHUB_EVENT_NAME:-}" != "pull_request" ]]; then
  all "not a pull_request event (${GITHUB_EVENT_NAME:-unknown})"
fi
if [[ -z "${BASE_SHA:-}" || -z "${HEAD_SHA:-}" ]]; then
  all "missing BASE_SHA/HEAD_SHA"
fi

# The three-dot compare: files changed on the PR branch since its merge base.
if ! resp=$(curl -fsS --retry 3 \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_REPOSITORY}/compare/${BASE_SHA}...${HEAD_SHA}"); then
  all "compare API request failed"
fi

count=$(jq '.files | length' <<<"$resp")
# The compare API caps the file list at 300; past it the list is incomplete.
if [[ "$count" -ge 300 ]]; then
  all "compare returned ${count} files (at the API cap, list may be incomplete)"
fi

passport=false
info=false
server=false
while IFS= read -r f; do
  case "$f" in
    # The info site imports the passport design tokens at build time.
    passport/src/design/*) passport=true; info=true ;;
    passport/*) passport=true ;;
    info/*) info=true ;;
    server/*) server=true ;;
    # Docs and prose: repo-wide format/lint runs in the always-on check job.
    labs/* | README.md | CLAUDE.md | LICENSE) ;;
    # Anything else (root configs, Makefile, .github, deploy, root tests)
    # could affect any gate: run everything.
    *) all "root-level change (${f})" ;;
  esac
done < <(jq -r '.files[].filename' <<<"$resp")

{
  echo "passport=${passport}"
  echo "info=${info}"
  echo "server=${server}"
} >>"$GITHUB_OUTPUT"
echo "→ ${count} changed files: passport=${passport} info=${info} server=${server}"
