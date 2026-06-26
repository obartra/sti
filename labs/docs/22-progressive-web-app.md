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

1. **Offline is a correct state, not an outage, because the device is the source of truth.** Every
   client's encrypted IndexedDB store is the real system of record; the server is a sync/routing
   cache, not the system of record ([10-build-backend-and-deployment.md:178](10-build-backend-and-deployment.md)).
   The pure core resolves the badge, the 90-day clock, and all per-site logic locally (doc 10). Three
   surfaces, three behaviors, and the network only matters for the second:
   - **The owner's own self-view is fully offline and authoritative.** The owner's blue or gray is
     computed on-device from their own data; the server is not consulted and is not needed. So an
     installed app with no signal shows the owner their **real** badge, not a gray. "Fresh confirmed
     read" is a property of a *viewer's* trust, not of the owner's knowledge of themselves, so it does
     not gate the owner's own screen. (This scopes the "gray everywhere when offline" last-resort of
     [doc 10:181](10-build-backend-and-deployment.md) to the served, viewer-facing surface, which is
     what it was always describing; it sharpens, it does not reopen, the lock.)
   - **What others see, the published or live badge, is server-mediated and fails closed to gray.**
     A viewer trusts blue only on a fresh confirmed read; stale or an unreachable server gives
     **gray, never stale-blue** ([02-decisions.md:156](02-decisions.md)). This is load-bearing:
     "unreachable server → gray" is what stops someone killing their connection to **dodge** gray. A
     "no internet" badge here would let a gray owner drop wifi and pass it off as a mere connection
     problem, so this surface stays gray.
   - **Viewing someone else's passport while offline can't render at all**, since it must fetch from
     `api.sti.care` with nothing cached. There is no badge to fabricate, so show an honest **"no
     internet, can't load this"** empty state. It is plainly about the viewer's own connection,
     identical for a blue person and a gray one, so it leaks nothing and asserts nothing.

   So the badge never gains a distinct "no connection" state, and connectivity is never paired with a
   shown badge as a "would be blue if online" hint. The PWA work makes the owner's own offline view
   first-class and fast; it does not invent new badge behavior.
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
> fails open to the network (section D) and why offline is exercised in CI (section K).

## C. The web app manifest (installable)

A `public/manifest.webmanifest`, linked from `index.html`, with a matching
`<meta name="theme-color">`. Concrete values from the design tokens:

| Field              | Value                                                          | Why                                                                                 |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `name`             | `sti.care passport`                                            | Full name on the install dialog and splash.                                         |
| `short_name`       | `sti.care`                                                     | Home-screen label, fits under the icon.                                             |
| `start_url`        | `/passport/`                                                   | Honors the gh-pages base path. No tracking query param (S5): install-vs-browser is detected client-side via `display-mode: standalone`, never a URL the page host could log. |
| `scope`            | `/passport/`                                                   | Matches the deploy path, so navigations stay in-app.                                 |
| `display`          | `standalone`                                                   | No browser chrome; it reads as an app.                                               |
| `theme_color`      | `#2F9BB3` (teal-500)                                           | Accent; status bar tint.                                                             |
| `background_color` | `#FBF9F4` (warm-50)                                            | The app background, so the splash matches the first paint with no flash.             |
| `icons`            | 192 and 512 px, plus a `purpose: "maskable"` variant          | Maskable so Android does not letterbox the favicon mark.                             |
| `categories`       | `["health", "medical"]`                                        | Store and launcher categorization.                                                  |
| `shortcuts`        | Care, Share, Connect                                           | Long-press launcher entries to the three primary routes.                            |
| `screenshots`      | a few captured states                                         | Richer install UI on Chromium; reuse the visual-baseline pipeline, do not hand-roll. Fixture data only (S7), never a real session capture, or a real badge or handle ships in a static asset. |

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

**Cache only the data-free shell (S6).** The privacy of the cache rests on the app being a
client-rendered SPA, so a cached HTML response is the app frame only and never contains user content.
This is an invariant, not an incidental: the precache and the navigation cache may hold **only the
data-free shell**, never an HTML response hydrated with user data. A future server-rendered or
prefilled route would silently write user content into CacheStorage at rest, so any such route must
opt out of the shell cache. User data stays in the encrypted store, never in an HTTP cache.

## E. Updates: how a new version reaches an installed app

The app version is already stamped (`__APP_VERSION__`), so the cache name carries it
(`shell-v{version}`). Policy:

- **No AUTOMATIC `skipWaiting()` and no `clients.claim()`; control begins at the next navigation.** A
  page that loaded WITHOUT the worker is never taken over mid-load. (We tried the aggressive pair
  first; claiming an in-flight page cancels its requests and can serve the HTML shell for a
  sub-resource, which then fails with a `text/html` script MIME error. Validated against the e2e
  suite.) So the worker installs quietly on visit one and controls from visit two, the standard PWA
  lifecycle. This is also what keeps old versions working: nothing is force-swapped under a running
  page.
- **Surface the update; let the user activate it.** When a newer worker is installed and waiting (a
  worker reaching `installed` while one already controls the page), the app shows a quiet, dismissible
  affordance. Tapping Reload posts the waiting worker a `SKIP_WAITING` message (the ONLY path that
  calls `skipWaiting`, so activation is always user-initiated); the worker activates, `controllerchange`
  fires, and the page reloads once onto the new version. Dismiss leaves the running version untouched;
  the next cold start picks the update up regardless. Copy follows voice and tone, outcome-first:
  **"A newer version is ready."** with **Reload** / **Not now** actions. (Implemented in slice 3:
  `swUpdate.ts`, `registerSw.ts`, `UpdateBanner.tsx`.)
- **No silent data migration risk.** The worker only ever touches the public shell cache. User data
  lives in the encrypted blob and is versioned by the app's own store-migration path, untouched here.

**Old versions keep working, and that is a feature, not a bug to floor out (S2).** Offline-first means
a stale app, like a stale badge, is a safe degraded state, so there is **no minimum-version floor**
that would brick an old cached shell. A user who has not been online for a long time keeps a working
app. The threat model around updates is therefore scoped precisely:

- **Accepted residual: a hostile network can withhold an update.** Dropping the update request makes
  network-first fall back to the shell the user already holds. That is a freshness denial-of-service
  and nothing more; the user stays on *their own* current version, never on an attacker's choice.
- **What still cannot happen: a forced downgrade to a chosen old version.** The worker only ever
  adopts a *newer* worker fetched over TLS from the real origin, and never moves backward;
  content-hashed immutable assets cannot be substituted byte-for-byte. So an attacker can suppress an
  update but cannot push a specific older (e.g. known-bad) shell onto a fresh reload. `sw.js` is
  served no-store so a genuine update is picked up the moment the network allows, which keeps
  "withhold" the only move a network attacker has.

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
  the tap. **It must drain through the same jitter and cover path as the existing send queue (doc 13),
  not in a synchronized reconnect burst (S3).** The server cannot read the ops (they are opaque), but
  a burst of writes landing the instant a device comes online is a linkability signal ("these N
  opaque ops belong to one device that just reconnected") that cuts against the sibling-alias
  decorrelation work (doc 18). Reconnect schedules the drain; it does not fire it all at once.
- **Periodic Background Sync:** lets an installed app go gray to blue, and poll notify inboxes,
  **without a foreground open**. It is gated **off by default**, same as push, and only meaningful
  where the platform supports it (Chromium, installed). **It is not simply "the same as push", and the
  gating review must treat it as its own shape (S4).** Push is server-to-device with cover-broadcast
  hiding *which* device; periodic sync is device-*initiated*, so the device reaches out and reads its
  per-contact inbox hashes on a regular cadence. That inverts the leak into two device-side signals
  the review must clear: a **liveness/cadence fingerprint**, and **co-read correlation** (all of one
  user's inbox hashes read together groups their contacts). Because of that inversion, periodic sync
  may be net-negative versus push rather than a free add; it ships only if the review shows the
  cadence and co-read are masked at least as well as the push path masks *which-device*.
- **Web Push:** already built (doc 13). The PWA work unblocks it on **iOS 16.4+**, which only
  delivers web push to an **installed** PWA. So "install" is not cosmetic on iOS; it is the gate for
  notifications at all. This is the strongest single reason the install path matters.

## H. Offline-created state: capture now, back up later

Three things a user does offline produce state that has to reach the server later: reporting a
result (republish the card so viewers see the new badge), backing up the account blob (cross-device
recovery), and accepting a contact link (register notify routing and push). The badge and the data
are already local and authoritative (principle 1); what is new is making the **outbound** half
durable and honest. This is what lets us say, truthfully, that the app creates a badge, installs,
and adds contacts with no signal.

**What works offline, stated precisely (so the claim stays honest):**

- **Report a result or change status:** fully local. The badge updates immediately on the owner's
  own screens.
- **See your own badge:** yes. **Show a verified badge to someone else:** no, that needs their
  device to do a fresh confirmed read online. A badge trusted from a cached QR is stale-blue, which
  the lock forbids, so we never render someone else's verified badge from offline data.
- **Add a contact in person:** the link payload (the alias plus the notify capability) rides in the
  fragment, so a scan captures it with no signal (`contactInvite.ts`). What waits for reconnect:
  resolving the other card to actually see their badge, and arming notifications (routing and push
  registration). So the honest line is **"swap contacts with no signal; you each see the other's
  badge and get nudges once either of you is back online,"** not "fully offline contacts."

**Storage: a durable outbound queue, not a different result format.** Results already persist in the
encrypted blob, so nothing about how a result is stored changes. What we add is two small things:

- a durable, encrypted **outbound queue** in IndexedDB holding the deferred server ops (republish
  alias, push the account-blob backup, register an accepted contact's notify routing and push), and
- a **"backed up as of" marker** so the app can tell, locally and honestly, that there are changes
  the server has not yet received.

**The queue is encrypted under the master key, and that constrains how it drains (S1).** The earlier
instinct, to treat it like the push context, is wrong: the push-context exception (doc 09) is
deliberately scoped to *low*-sensitivity inbox-read capabilities (read or clear the contentless
pending-nudge bit, never who, what, or when). The outbound ops are higher: a republish or revoke
carries the alias **write token**, a contact registration the **routing token**, and those exist
today only inside the master-encrypted blob. Putting them in a plaintext queue is a new
at-rest exposure for a thief-with-device (write tokens overwrite or revoke the owner's published
aliases), not an equivalent trade. So the queue is sealed under the master key like the blob it
mirrors.

That has a real mechanism cost worth stating plainly: a `sync`-event handler runs in the worker,
which **never holds the master key** (the key is never persisted). So a sealed queue cannot be
drained headless by the worker. The resolution: **the queue drains on the next unlocked, online
foreground**, not in a true-background `sync` event. Background Sync and the foreground flush both
just signal "there is work and the network is back"; the actual sealed-op replay happens with the
key in memory. We accept that write-bearing outbound ops do not flush while the app is closed; only
genuinely contentless, low-sensitivity ops (if any are ever added) may use a worker-drainable lane,
and only at the push-context sensitivity bar. The drain still uses the decorrelated jitter path
(S3), never a reconnect burst.

**UI affordances: surface it once, passively, let it resolve itself.** The anti-pestering rule is
the design:

- **One passive, persistent, non-modal marker** in the chrome while the queue is non-empty: a quiet
  indicator, not a toast, not a banner that recurs. It clears itself silently when the queue drains.
- **At most one gentle inline line** at the moment of a consequential offline action, shown once and
  never repeated: after reporting a result with no signal, a quiet "Saved on this device. It backs
  up when you're online." (voice and tone: plain, outcome-first, "back up" not "sync", no alarm).
- **Never block, never modal, never nag.** No "you are offline" interstitial, no repeated reminders,
  no red. The default is silence; the marker is there for a user who looks.
- **The honest stake, said once where it belongs:** until it backs up, changes live only on this
  device, so a phone lost before reconnecting loses them. State it calmly in the backup/recovery
  surface, not as a recurring warning on every screen.
- **On reconnect** the queue drains in the background and the marker disappears. No success toast is
  needed; any confirmation is brief and dismissible, never celebratory.

All copy here is governed by [21-voice-and-tone.md](21-voice-and-tone.md) and reviewed before merge.

## I. Platform reality: a capability floor, then progressive ceilings

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

## J. Build slices

Each slice is independently shippable and leaves the app correct.

1. **Installable (BUILT).** Manifest, maskable icons, `theme-color`, `index.html` links. No worker
   change. Outcome: the app installs and launches standalone; nothing regresses.
2. **Offline shell (BUILT).** `install`/`activate`/`fetch` composed into the existing worker
   (section B), a build-time precache manifest, the cross-origin (incl. API) passthrough. Outcome:
   the installed app opens offline and renders the owner's own local status.
3. **Update UX (BUILT).** Versioned shell cache, a user-initiated `SKIP_WAITING` activation, and the
   voice-reviewed "reload to update" affordance (no automatic skipWaiting/claim; section E).
4. **Offline-created state (section H), BUILT.** This was the foundational change anticipated below:
   the encrypted blob is now cached in a master-key-sealed local store (`localBlobStore.ts`), and the
   sync (`offlineSync.ts`) reads **local-first** (so a reload restores the session offline) and writes
   **local-first then server** (`save` never throws offline; the edit is durable and the account is
   marked pending). `setOwnerState` keeps its online path but, on any server-step failure, persists
   the state change locally without throwing (aligning with decision 156's no-"couldn't refresh"
   rule). A reconnect drain (`useBackupSync`) re-applies the current state to push the blob and
   republish, in the foreground where the master lives (S1). A passive `NotBackedUp` marker shows
   while pending and clears itself on backup. Tested at the sync layer and against the real server
   (integration suite stays green). **Residuals (named):** minting a NEW share link and registering
   push still need the network (a viewer fetches the alias from the server), so those stay online;
   an expired link's server-side revoke lingers offline until reconnect (doc 16); and the reconnect
   drain re-publishes even after a profile-only offline edit (one extra decorrelated write, harmless).
5. **Periodic Background Sync**, gated off by default, behind the same review the push wake passed.

Slices 1 to 4 are built. Slice 5 stays gated off by the security review (section L).

## K. Testing and gates

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

## L. Security and threat surface

The PWA adds three new actors: a worker that intercepts navigations, a set of at-rest caches, and
optional background runners. This section is the single place a reviewer checks that they did not
weaken the project's invariants. The per-section fixes (S1 to S7) live where they bite; this
summarizes what holds and what residuals are accepted.

**Invariants the PWA must preserve (and how):**

- **No `api.sti.care` response is ever cached** (section D), so no visit or existence trail at rest,
  and the existence-blind endpoints stay network-uniform.
- **Caches hold only the data-free shell** (S6), never an HTML response hydrated with user content.
- **The outbound queue is master-key sealed** (S1); write and routing tokens never sit in plaintext
  at rest, so a thief-with-device gains no capability the encrypted blob did not already gate.
- **Outbound ops drain through the existing jitter and cover path** (S3), never a synchronized
  reconnect burst, preserving sibling-alias decorrelation (doc 18).
- **No usage beacons** (S5): no tracking query params; install state is read client-side.

**The worker as a persistent actor.** A `fetch` handler at scope `/` outlives page loads and can
serve a cached shell indefinitely. The integrity story rests on TLS plus content-hashed immutable
assets plus a forward-only worker (section E): an attacker can suppress an update but cannot
substitute or downgrade to a chosen shell. `sw.js` is served no-store, scope stays minimal, and the
handler fails open to the network so a worker bug degrades to a plain online browser, never a brick.

**Accepted residuals (named, not buried):**

- **Update-withholding (S2).** A hostile network can pin a user to the version they already hold (a
  freshness denial-of-service). Accepted: keeping old versions working is a deliberate capability,
  and the user is never pushed *backward* to an attacker's choice.
- **Device-at-rest.** CacheStorage and IndexedDB are unencrypted at rest, the same caveat doc 09
  already discloses. The PWA does not widen it: the shell cache is public, and the sensitive queue is
  sealed.
- **Closed-app flush of write-bearing ops (S1).** Because the worker has no master key, sealed
  outbound ops flush only on the next unlocked foreground, not headless. Accepted in exchange for not
  exposing write tokens at rest.
- **Periodic Background Sync (S4)** stays gated off until its review clears the device-side cadence
  and co-read signals; it is not assumed safe by analogy to push.
- **Compromised build or hosting pipeline (the ceiling).** A service worker is a persistent actor:
  if the build, gh-pages, or the CDN is ever compromised, a malicious worker can install itself and
  outlive the cleanup of the origin. The integrity story above defends against the *network*, not a
  compromised *origin*, and merging the fetch handler into the worker raises the blast radius and
  lengthens recovery. This is largely out of scope (a compromised origin defeats most web apps), but
  it is the honest ceiling of this design, so it is named rather than implied. Practical hedges if we
  ever want to raise it: pin the worker build in CI, keep the worker scope minimal, and prefer a
  short, auditable worker over a large one.

## M. Open questions and residuals

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
- **The owner's offline self-view should be ratified in the decisions log.** Principle 1 reads the
  device as authoritative for the owner's own badge, so it renders fully offline rather than graying.
  This is the natural consequence of "client store is the source of truth" (doc 10:178), but it
  sharpens decision 156's "fresh confirmed read" to be viewer-facing only. Worth a one-line decision
  entry confirming that scope so no future reader takes 156 to gray the owner's own screen offline.
- **Sync-staleness cue for the owner (separate from the badge).** Offline, the owner sees their true
  badge, but their *published* reflection (what viewers get) may lag until they reconnect. Whether to
  surface that lag at all, and how without implying anything about the badge, is an open call. Any
  such cue is app chrome, voice-and-tone copy, badge semantics untouched, and a deliberate
  decision-log change rather than something this doc bakes in.
