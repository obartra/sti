# sti.care: Progressive Web App

_New, June 26, 2026._

*The "how it becomes an app you install." How the passport turns from a tab into an installable,
offline-first PWA without giving the blind server anything new to see. Pairs with
[Build, backend & deployment](10-build-backend-and-deployment.md) (which already commits to
"PWA, offline-first"), [Data & storage](09-data-and-storage.md) (what may and may not sit at rest
on a device), the [Decisions log](02-decisions.md) (fail-closed-to-gray, locked), and
[Contact graph & notification](13-contact-graph-and-notification.md) (the push worker this builds
on). Not legal advice.*

---

## In one line

We already ship a service worker for partner-notify wakes and keep all sensitive data in an
encrypted IndexedDB blob. This doc closes the gap to a fully capable, installable PWA: a web app
manifest, an offline app shell, a sane update flow, and the background capabilities a phone OS
offers, with one hard line drawn around what a cache is ever allowed to hold.

## Two principles this build is organized around

1. **Offline is a correct state, not an outage.** The pure core resolves the badge, the 90-day
   clock, and all per-site logic with no network (doc 10). The only thing the network adds is the
   fresh confirmed read that turns a badge blue, and the locked rule is already
   **gray, never stale-blue** ([02-decisions.md](02-decisions.md)). So an installed app that opens
   with no signal is not broken: it shows the user's own data and a correct gray. The PWA work makes
   that state reachable and fast, it does not invent new behavior.
2. **A cache is storage the server can't see but an attacker with the phone can.** CacheStorage and
   IndexedDB are unencrypted at rest, exactly like the push context already is (doc 09, the one
   honest caveat). Everything we precache must be **public, non-sensitive app code**, the same bytes
   we serve to everyone. No response from `api.sti.care` is ever cached. This keeps the blind-server
   model and the device-at-rest model both intact.

---

## A. Where we are today

- **A push service worker already exists** at `dist/sw.js`, scope `/`, bundled by
  `vite.sw.config.ts` from `src/sw/sw.ts`. It handles `push` and `notificationclick` only: on a wake
  it polls the per-contact notify inboxes and shows one contentless nudge (doc 13). It has **no
  `install`, `activate`, or `fetch` handler**, so it controls notifications but not navigations or
  assets.
- **All sensitive data is already on-device** in a passkey- or passphrase-derived AES-GCM blob in
  IndexedDB; the push context (lower-sensitivity inbox capabilities) sits beside it (doc 09).
- **The build is static**, output to `gh-pages` under `/passport/`, with a repo-wide version stamped
  into both the app and the worker via `__APP_VERSION__`.
- **What is missing for "installable, capable PWA":** a web app manifest, maskable icons, an offline
  app shell (precache + a `fetch` handler), an update-ready signal, an install affordance, and the
  optional background-sync capabilities. `index.html` today links only a favicon.

## B. The load-bearing constraint: one worker per scope

A browser runs **exactly one service worker per scope**. We already own scope `/` with the push
worker. We therefore **do not register a second worker**; the offline and lifecycle responsibilities
are composed **into the same bundled worker** at `src/sw/sw.ts`.

Concretely, the worker grows three modules behind its existing push module, each its own file under
`src/sw/` so the statement ceilings hold and each tests in isolation:

- `swPrecache.ts`: the `install` handler. Opens a versioned cache, adds the precache manifest
  (hashed JS/CSS/fonts/icons + the navigation shell), and calls `skipWaiting()` per the update
  policy in section E.
- `swActivate.ts`: the `activate` handler. Deletes caches from prior versions and calls
  `clients.claim()`.
- `swFetch.ts`: the `fetch` handler. Routes by request, per the table in section D. The push module
  is untouched.

The precache manifest is generated at build time. Vite already knows the hashed asset graph, so a
small post-build step (or a manifest plugin) writes the list the worker imports; we do not hand-edit
it, the same discipline visual baselines follow.

> One real risk to call out: composing a `fetch` handler into the worker that currently only does
> push means a worker bug can now break navigation, not just a nudge. That is why the fetch handler
> fails open to the network (section D) and why offline is exercised in CI (section H).

## C. The web app manifest (installable)

A `public/manifest.webmanifest`, linked from `index.html`, with a matching
`<meta name="theme-color">`. Concrete values from the design tokens:

| Field              | Value                                                          | Why                                                                                 |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `name`             | `sti.care passport`                                            | Full name on the install dialog and splash.                                         |
| `short_name`       | `sti.care`                                                     | Home-screen label, fits under the icon.                                             |
| `start_url`        | `/passport/?source=pwa`                                        | Honors the gh-pages base path; the param lets us see install opens in client logs only. |
| `scope`            | `/passport/`                                                   | Matches the deploy path, so navigations stay in-app.                                 |
| `display`          | `standalone`                                                   | No browser chrome; it reads as an app.                                               |
| `theme_color`      | `#2F9BB3` (teal-500)                                           | Accent; status bar tint.                                                             |
| `background_color` | `#FBF9F4` (warm-50)                                            | The app background, so the splash matches the first paint with no flash.             |
| `icons`            | 192 and 512 px, plus a `purpose: "maskable"` variant          | Maskable so Android does not letterbox the favicon mark.                             |
| `categories`       | `["health", "medical"]`                                        | Store and launcher categorization.                                                  |
| `shortcuts`        | Care, Share, Connect                                           | Long-press launcher entries to the three primary routes.                            |
| `screenshots`      | a few captured states                                         | Richer install UI on Chromium; reuse the visual-baseline pipeline, do not hand-roll. |

Icons derive from the existing `public/favicon.svg` (teal rounded square, white mark). The maskable
variant needs the mark inside the safe zone with the teal extended to the bleeders, so Android's mask
never clips it.

**Copy note.** The install dialog text comes from the OS, not us, but `name`/`short_name` are
user-facing strings and follow [voice and tone](21-voice-and-tone.md): plain, no jargon, no
internal words. Any in-app install nudge (section F) is fully governed by that guide.

We do **not** add `share_target` in this pass. Receiving a shared passport link into the app is a
real existence-and-routing surface and belongs to the link-resolution flow (doc 16), not the install
manifest; noted as a deferred question.

## D. The offline app shell: what the fetch handler does

The routing rule is short, and the privacy line is the whole point.

| Request                                               | Strategy                                   | Rationale                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Hashed static assets (`*.[hash].js/.css`, fonts, icons) | **Cache-first**                            | Content-hashed and immutable; safe and fast from cache forever.                                                              |
| Navigation / the HTML shell                           | **Network-first, fall back to cached shell** | Picks up a new deploy when online; still opens offline. The shell is just the app frame, it holds no user data.             |
| Anything on `api.sti.care`                            | **Network-only, never cached**             | The blind-server line. See below.                                                                                            |
| Cross-origin / everything else                        | **Pass through** (no SW involvement)        | We only manage our own shell.                                                                                                |

**Why no API response is ever cached, even though it is ciphertext.** Caching a `GET /a/{id}` or a
notify-inbox read would leave a **local record that this device fetched that id**, a visit and
existence trail the server itself is engineered never to keep (doc 09, doc 13). It would also create
a path to render a **stale** passport, which collides head-on with the locked
**gray-never-stale-blue** rule. And the existence-sensitive endpoints (`GET /a/{id}`, `POST /knock`)
must stay uniform in timing and result (doc 10); a cache hit is a distinguishable timing. So the
fetch handler explicitly excludes the API origin: those requests go to the network or they fail, and
a failure renders as the correct gray. The user's own status is already local in the encrypted blob;
the app does not need the network to show it.

The handler **fails open**: any unexpected error inside it falls through to `fetch(request)`, so a
worker bug degrades to "normal online browser", never to a white screen.

## E. Updates: how a new version reaches an installed app

The app version is already stamped (`__APP_VERSION__`), so the cache name carries it
(`shell-v{version}`). Policy:

- **`skipWaiting()` + `clients.claim()`**, so a new worker takes over promptly rather than waiting
  for every tab to close. Safe here because the shell is versioned and the fetch handler never mixes
  asset versions within a load (cache-first on immutable hashes).
- **Surface the update, do not force a jarring reload.** When a new worker has installed and is
  waiting/active, the app shows a quiet, dismissible "refresh to update" affordance. Reloading is the
  user's choice; the next cold start picks it up regardless. The copy follows voice and tone:
  outcome-first, no mechanism, no nag. Draft: **"A newer version is ready. Reload to use it."** with
  a Reload action. (Final string reviewed against the guide before merge.)
- **No silent data migration risk.** The worker only ever touches the public shell cache. User data
  lives in the encrypted blob and is versioned by the app's own store-migration path, untouched here.

## F. Install affordance (progressive, never naggy)

- **Chromium (Android, desktop):** capture `beforeinstallprompt`, stash it, and offer a single,
  easy-to-ignore "Add to home screen" entry point in a sensible spot (for example, a one-time row in
  settings or an occasional, dismissible hint), never a modal that blocks the flow. Fire the stored
  prompt on tap.
- **iOS Safari:** there is no install event. If we detect iOS and not-standalone, we can show brief
  Add-to-Home-Screen guidance **only where it pays for itself** (notably: iOS only allows Web Push
  inside an installed PWA, so the push-enable flow in doc 13 is the honest place to mention install).
  Elsewhere we stay quiet.
- **Already installed** (`display-mode: standalone`): never prompt.

Copy is minimal and voice-compliant: lead with the benefit ("Keep your passport one tap away. It
works offline, and we still can't see your status."), no preamble, no hype. Reviewed against
[21-voice-and-tone.md](21-voice-and-tone.md) before merge.

## G. Background capabilities (the "most capable" part), gated

These make the install genuinely app-like. Each is **progressive** (absent gracefully when the
platform lacks it) and **privacy-reviewed**, because each adds a background actor.

- **Background Sync** (one-shot): when the user fires an outbound action offline (a nudge, a knock,
  a vanity-name change), register a sync so the worker retries it on reconnect instead of failing at
  the tap. Outbound only; it carries no new at-rest data beyond the queued job, and the server side
  already batches sends to hide timing (doc 13).
- **Periodic Background Sync:** lets an installed app go gray to blue, and poll notify inboxes,
  **without a foreground open**. This overlaps the existing push wake and reuses its exact model:
  contentless, cover-broadcast, decrypt-locally. It is gated **off by default**, same as push, and
  only meaningful where the platform supports it (Chromium, installed). It must obey the same rule
  the push worker does: poll, decrypt locally, reveal nothing to the server.
- **Web Push:** already built (doc 13). The PWA work unblocks it on **iOS 16.4+**, which only
  delivers web push to an **installed** PWA. So "install" is not cosmetic on iOS; it is the gate for
  notifications at all. This is the strongest single reason the install path matters.

## H. Platform reality: a capability floor, then progressive ceilings

Every feature above degrades cleanly. The **floor** every supported browser gets is: an installable,
offline-capable shell that renders the user's own status with no network. Ceilings stack on top
where the platform allows.

| Capability             | Chromium (Android/desktop) | iOS Safari 16.4+         | Older / unsupported     |
| ---------------------- | -------------------------- | ------------------------ | ----------------------- |
| Installable shell      | Yes (`beforeinstallprompt`) | Yes (manual A2HS)        | Browser tab still works |
| Offline app shell      | Yes                        | Yes                      | Online-only, unchanged  |
| Web Push               | Yes                        | Installed PWA only       | Absent, feature hidden  |
| Background Sync        | Yes                        | No                       | Absent, retry on open   |
| Periodic Background Sync | Yes (gated)              | No                       | Absent, foreground refresh |

The honest line for users, when we say anything at all, is the floor: it works offline and we still
can't read it. We never promise a background feature a given phone won't deliver.

## I. Build slices

Each slice is independently shippable and leaves the app correct.

1. **Installable.** Manifest, maskable icons, `theme-color`, `index.html` links. No worker change
   yet. Outcome: the app installs and launches standalone; offline still shows nothing cached, but
   nothing regresses.
2. **Offline shell.** Compose `install`/`activate`/`fetch` into the existing worker (section B),
   generate the precache manifest at build, ship the API-origin exclusion. Outcome: the installed app
   opens offline and renders the user's own gray/blue-from-local status.
3. **Update UX.** Versioned caches, `skipWaiting`/`claim`, the voice-reviewed "reload to update"
   affordance.
4. **Background Sync** for outbound actions.
5. **Periodic Background Sync**, gated off by default, behind the same review the push wake passed.

Slices 4 and 5 are optional polish; 1 to 3 are the core "capable PWA".

## J. Testing and gates

- **Lighthouse PWA audit** wired into CI as a gate (installable, manifest valid, offline-200). It
  catches manifest and icon regressions mechanically.
- **Playwright** already drives a service worker (doc 14) and can simulate offline: an e2e that
  installs the worker, goes offline, reloads, and asserts the app shell renders and the badge is the
  correct gray. A second asserts **no `api.sti.care` request is served from cache** (the privacy
  invariant as an executable spec, the project's preferred shape).
- **Unit:** the cache-routing decision (which strategy per request) is pure and tests in Node with
  no DOM, like the rest of the core. `fake-indexeddb` already backs the store tests.
- **The standard gates** still apply: typecheck, lint, test, build, `build-storybook`, prettier,
  Go suite, no em dashes (CLAUDE.md).

## K. Open questions and residuals

- **`share_target`** (receive a shared passport link into the installed app). Deferred: it is an
  existence-and-routing surface that belongs with link resolution (doc 16), not the manifest. Decide
  whether it ever pays for its privacy cost.
- **Periodic sync vs push overlap.** Both can drive a background refresh. If push covers the need on
  the platforms that matter, periodic sync may not be worth the second background actor; revisit when
  push graduates from gated.
- **iOS install friction.** Manual Add-to-Home-Screen has real drop-off, and it gates push on iOS.
  Open question whether a one-time, dismissible explainer in the push-enable flow lifts it enough to
  justify the copy, or whether we stay silent and accept fewer iOS push opt-ins.
- **Precache size budget.** The shell must stay small enough to install fast on a weak connection.
  Set a budget and fail the build if the precache manifest exceeds it, rather than discovering it on
  a phone.
- **Wallet passes vs install.** The live-status wallet pass (doc 02, doc 03) is the OS-native offline
  status surface; the installed PWA is the app surface. They are complementary, not a choice; keep
  the two from implying different freshness rules to the user.
