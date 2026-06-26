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

## Gates before a PR

- `(cd passport && npm run typecheck && npm run lint && npm test && npm run build && npm run build-storybook)`
- `npx prettier --check .` from the repo root (passport's lint is eslint-only and misses formatting)
- `(cd server && go build ./... && go test ./... && go vet ./... && gofmt -l internal/ cmd/)`
- No em dashes anywhere (code, copy, docs, commits). Visual/baseline changes regenerate via the `screenshot:update` PR label, never hand-edited.
