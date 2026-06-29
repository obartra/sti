# sti.care

A privacy-first, blind-store sexual-health passport. Vite/React frontend
(`passport/`), Go + SQLite backend (`server/`). Design docs live in `labs/docs/`.

## User-facing copy: always follow the voice guide

**Any text a user reads is governed by [labs/docs/21-voice-and-tone.md](labs/docs/21-voice-and-tone.md).**
This is a hard rule, not a suggestion. It covers voice, tone, register, reading
level, the no-jargon vocabulary, and the honesty rules (state what is protected,
never describe how to attack the system).

Before writing or changing any screen, button, label, error, notification, empty
state, or share/consent string, read that guide and match it. When you touch a
surface for another reason, fix copy that violates it. The voice is part of the
product, not decoration.

Quick test: read the line aloud. If it sounds like a brochure, a lawyer, a hospital
form, or a hype tweet, or if it leans on internal words (alias, linkup, knock,
findable, decoy), rewrite it plainly.

## Design docs (`labs/docs/`)

Docs reflect the current codebase state or an immediate action plan, nothing else. Keep brittle
metadata out, it only rots and creates churn:

- No line-number cross-references. Link a doc or name a section heading, never `other-doc.md:142`.
- No date or draft-status headers, and no per-edit timestamps. Semantic state that is true of the
  code (locked, built, launched) is fine; the date stamped next to it is not.
- No rot-prone counts of source artifacts (number of screens, files, tests, components). Real
  protocol and crypto constants that are the spec (key sizes, iteration counts, fixed payload sizes,
  time windows) are codebase state, keep them.

Whenever a doc is added or substantially changed, do a review and consolidation round before the PR.
Evaluate everything added: does it belong at all, is it in the right doc and the right place, does it
follow these conventions and the voice guide, is it detailed enough, correct enough, and consistent
with the rest of the set. Fold duplication into a single owner and cross-reference it rather than
restating it. A new doc is not done until the whole set still reads as one coherent body.

## Gates before a PR

- `(cd passport && npm run typecheck && npm run lint && npm run test && npm run build && npm run build-storybook)` (passport is npm-based, not pnpm; the Makefile and CI invoke it the same way)
- `npx prettier --check .` from the repo root (passport's lint is eslint-only and misses formatting)
- `(cd server && go build ./... && go test ./... && go vet ./... && gofmt -l internal/ cmd/)`
- No em dashes anywhere (code, copy, docs, commits). Visual/baseline changes regenerate via the `screenshot:update` PR label, never hand-edited.
