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

Run `make check` from the repo root before opening a PR. It is the canonical fast
pre-push gate and runs strictly more than any hand-rolled subset:

- `check-root`: inclusive-language, prettier, eslint, node tests.
- `check-web` (passport): eslint, `lint:styles` (the doc 37 ratchet), typecheck,
  `knip` unused-code, unit tests.
- `check-info`: astro check, voice lint, style lint, build.
- `check-server`: gofmt, vet, deadcode, go test, alert-script tests.

`make ci` mirrors everything CI runs on top of that (integration, e2e, vulncheck,
smoke). Prefer these targets over running pieces by hand: `lint:styles` and `knip` are
the two easiest to forget, and they only fail once CI runs after you have pushed.

- New user-facing UI follows the editorial grammar (doc 37): the passport style-lint
  ratchet rejects any new inline `style={}`, raw hex color, or use of the stranded
  `Card` / `Badge` / `Row` / `Segmented` components. Build new screens with the `.e-*`
  classes and a co-located CSS file (tokens only, no raw hex), never inline styles.
- No em dashes anywhere (code, copy, docs, commits). Visual/baseline changes regenerate
  via the `screenshot:update` PR label, never hand-edited.
