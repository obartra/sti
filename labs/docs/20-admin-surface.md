# sti.care: Admin Surface (v1 spec)

_A minimal, authed operator surface for the governance actions the blind store leaves to a human:
the Findable takedown review ([doc 17](17-vanity-namespace-governance.md)) first, account/alias
management next. This doc defines the auth model, the page, the endpoints, and, critically, the
hard limits the blind architecture places on what "admin" can even mean._

## Why this doc

Some operational actions cannot be hands-free or client-side: reviewing a reported vanity name,
disabling an abusive account, revoking a leaked alias. They need a privileged surface. But this is a
**blind** store, so the surface is far smaller and safer than a typical admin panel, and that has to be
stated precisely so it is neither over-built nor over-trusted.

## The blind-store boundary (the load-bearing constraint)

The server holds only opaque, client-encrypted ciphertext keyed to each owner's root key (docs 02/09).
The admin secret does **not** unlock any of it. So:

- **Admin CAN** act on server-side records: delete an account's blob + aliases (a working delete),
  revoke a single alias (overwrite to garbage), lock / release / take down a vanity name, and read
  **opaque metadata** only (record ids, byte sizes, timestamps, counts).
- **Admin CANNOT** read or edit encrypted content: a status, a result, a badge, a handle, a profile.
  There is no key. "Edit another account" therefore means **disable / remove + manage that account's
  public records**, never content editing. This is a guarantee, not a gap: even a leaked admin secret
  cannot decrypt a single user's status.

Anything an admin endpoint returns or mutates MUST stay within this boundary; an endpoint that needed
plaintext would be a design error, not a missing feature.

## Auth

- **Shared admin bearer secret.** A long random secret set server-side via `STI_ADMIN_TOKEN` (env, like
  the decoy/VAPID secrets). Never in the repo, never logged, never sent to the client except as the
  operator typing it into the admin page.
- The admin page sends it as `Authorization: Bearer <token>`; the server compares **constant-time**
  (`subtle.ConstantTimeCompare`) against the configured value. A miss is a uniform `401`.
- **Flag-gated.** The whole admin surface (page + endpoints) is off unless `STI_ADMIN_ENABLED=true`
  AND `STI_ADMIN_TOKEN` is set and non-trivial (length floor enforced at boot, else the server refuses
  to enable admin). Default: disabled, so production ships dark until deliberately turned on.
- **Page-side handling.** The token is entered once and kept in `sessionStorage` (cleared on tab close),
  never `localStorage`, never a cookie (so no CSRF surface; admin endpoints are bearer-only and set no
  cookies). A 401 clears it and re-prompts.
- **Rotation.** Rotating = change the env value + restart. No per-action expiry in v1.
- **Future hardening (not v1):** an optional IP allowlist, and/or an admin WebAuthn credential to retire
  the shared secret. Designed for later; the bearer is the v1 control.

## Threat model

The single point of failure is the secret. A leak grants every admin action below until rotated. The
blast radius is bounded by the blind-store boundary (no status/content is ever exposed, even with the
secret) and by:

- a long, random, env-only secret with a boot-time length floor;
- constant-time comparison (no timing oracle);
- the flag (off by default; one place to kill the whole surface);
- an append-only **audit log** of every admin action (actor is "admin", action, target id, timestamp;
  never user content), so any misuse is reconstructable;
- a tight per-IP rate limit on `/admin/*` (reuse the existing limiter), uniform `401`/`429`.

## The admin page

A dedicated, gated route (`/admin`), isolated from the user flows. It is built as a **separate
bundle / entry point**, not code-split out of the user app: the operator surface and the
user-facing passport share no chunk, so admin can pull in heavier dependencies (a charting library,
a richer table/grid) without adding a byte to the user bundle or sitting near a health surface, and
the shell budget in [doc 22](22-progressive-web-app.md) is unaffected. It is built for a **desktop
operator** (a wide, multi-panel dashboard layout), not the mobile-first passport frame, since this
is where the richer aggregate views live.

- A token gate: enter the bearer secret; on success, the page calls a cheap `GET /admin/ping` to
  validate before showing anything.
- **v1 panel — Findable review (doc 17 §146):** the queue of reported vanity names not auto-actioned,
  each with the reported name, the report reason, and two one-click actions: **Take down** (revoke →
  24h lock) or **Dismiss**. Volume is shown but never auto-acts.
- **Something-wrong panel ([doc 35](35-something-wrong-reports.md)):** the queue of reports filed
  through the public "Something wrong?" form, each with its category, the optional note the person
  typed, and a time, with one action: **Resolve** (clear it once handled). The note is the one piece of
  user-typed text the store holds; the panel is where the operator reads it.
- **Activity panel (A4):** a read-only tail of recent admin actions (action, target, time), newest
  first. This makes the audit log's "reconstructable" promise usable from the page instead of only via
  SQLite on the box. Read-only, no actions; the same opaque rows the log already stores.
- **Metrics panel:** a read-only dashboard of **aggregate, identifier-free** operational counts,
  shown as **helpful charts** on the desktop layout: number cards for current totals, time-series
  line/area charts for per-day trends, and a small bar/series for the report queue and its latency.
  (The separate admin bundle is what lets this use a real charting library freely.) Only system-level
  totals and trends: total accounts / aliases / live links, accounts created and reports filed per
  day over a recent window, and the report-queue size and review latency. These are the same
  identifier-free service telemetry the blind-store boundary already permits (see below). The hard
  rules: never a per-account or per-id figure, never a distribution that fingerprints one account
  ("accounts with > N links"), never anything that correlates accounts. Counts of opaque rows, not
  facts about people.
- **Built to grow:** the page is a shell with panels, so account disable, alias revoke, and metadata
  lookup by id drop in as additional panels without re-architecting. The management panel now ships
  those three in the console (lookup renders opaque metadata only; disable and revoke each take a
  deliberate second confirming click, since they act on a raw operator-typed id with no queue context).

The page renders nothing and calls nothing until a valid token is present; it carries no user-facing
chrome and is never linked from the app.

## Endpoints (all bearer + flag gated, rate-limited, audited)

- `GET /admin/ping` — 204 if the token is valid (page gate).
- `GET /admin/reports` — pending vanity-name reports (name, reason, count, created_at). Opaque only.
- `GET /admin/audit` — the most recent admin actions (action verb, opaque target, timestamp), newest
  first, capped. A read, so not itself audited. The read surface for the audit log the rest of the doc
  leans on for "reconstructable"; without it the log is reachable only by querying SQLite on the box.
  Opaque only (a fixed verb + an id/name + a time), never user content.
- `POST /admin/vanity/{name}/takedown` — revoke the name's alias mapping → 24h lock (doc 17 lifecycle).
- `POST /admin/vanity/{name}/dismiss` — clear the report(s) without action.
- `GET /admin/feedback`: open "Something wrong?" reports (id, category, note, created_at), newest
  first, capped ([doc 35](35-something-wrong-reports.md)). A read, so not itself audited. Operator-readable
  by design (the note is text the person wrote), never encrypted user content.
- `POST /admin/feedback/{id}/resolve`: mark a report handled so it leaves the queue. Audited.
- `POST /admin/account/{id}/disable` — working-delete the account sync blob (aliases are revoked
  separately, not cascaded). Shipped.
- `POST /admin/alias/{id}/revoke` — force-remove an alias row and release any vanity name pointing at
  it, so the id reads back as a decoy. Shipped.
- `GET /admin/lookup/{id}` — opaque metadata for a record (existence, ciphertext byte size, last
  written), never content. Shipped.
- `GET /admin/metrics`: aggregate, identifier-free service counts for the metrics panel. No
  per-account or per-id figures; a read, so not itself audited. The current totals (accounts, aliases,
  live knocks, send-queue depth, database size, and the report-queue size) are shipped; the per-day
  trends and review-latency series are still to come.

Every mutation writes an audit row and returns a uniform shape; none returns plaintext content.

## What this does not change

- No new ability to read encrypted user data. No identity verification. No content editing.
- The user-facing app is untouched; admin is a separate, flagged surface.
- Findable still ships only when doc 17's launch gate is met; this doc provides the **review step**
  that gate's report-and-takedown item depends on.

## Build slices

1. **A1 — Auth + flag + page gate:** `STI_ADMIN_ENABLED` + `STI_ADMIN_TOKEN` (boot length floor),
   constant-time bearer middleware, rate limit, audit-log table + writer, `GET /admin/ping`, and the
   `/admin` route with the token gate. Nothing actionable yet.
2. **A2 — Findable review:** report store + `GET /admin/reports`, the takedown/dismiss endpoints
   (consume doc 17's lifecycle), and the review panel. This is Findable's F4 reviewer step.
3. **A3 — Account / alias management:** disable-account + revoke-alias + opaque lookup, all within the
   blind-store boundary (admin.go + admin_test.go), driven from the console's management panel. The
   endpoints are live and audited. Notes from the build: disable-account deletes only the sync blob (the blind store keeps no
   account→alias link, so aliases are revoked separately, not cascaded); and alias-revoke is two
   non-atomic steps (delete the alias row, then release any vanity name pointing at it), so if the
   second fails the name briefly maps to a dead id (a knock just fails) and re-running revoke,
   idempotent on both halves, completes it. The audit row is written before either step, so the attempt
   is always recorded.
4. **A4 — Activity (audit read):** `GET /admin/audit` over the existing `RecentAudits` store reader,
   plus a read-only Activity panel in the authed shell. Closes the loop the audit log opened in A1: the
   log was always written but had no read surface. A capped fetch with `before`/`limit` cursor
   pagination (newest-first; the panel's "Load older" walks back by row id, capped at 200 per page).
