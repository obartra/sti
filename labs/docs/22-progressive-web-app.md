# sti.care: Progressive Web App

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
   cache, not the system of record ([10-build-backend-and-deployment.md](10-build-backend-and-deployment.md)).
   The pure core resolves the badge, the 90-day clock, and all per-site logic locally (doc 10). Three
   surfaces, three behaviors, and the network only matters for the second:
   - **The owner's own self-view is fully offline and authoritative.** The owner's blue or gray is
     computed on-device from their own data; the server is not consulted and is not needed. So an
     installed app with no signal shows the owner their **real** badge, not a gray. "Fresh confirmed
     read" is a property of a *viewer's* trust, not of the owner's knowledge of themselves, so it does
     not gate the owner's own screen. (This scopes the "gray everywhere when offline" last-resort of
     [doc 10](10-build-backend-and-deployment.md) to the served, viewer-facing surface, which is
     what it was always describing; it sharpens, it does not reopen, the lock.)
   - **What others see, the published or live badge, is server-mediated and fails closed to gray.**
     A viewer trusts blue only on a fresh confirmed read; stale or an unreachable server gives
     **gray, never stale-blue** ([02-decisions.md](02-decisions.md)). This is load-bearing:
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
- **The build is static**, deployed via Netlify (`netlify.toml`) with the app served at the site root
  (Storybook at `/design`), and a repo-wide version stamped into both the app and the worker via
  `__APP_VERSION__`. The manifest and service worker are base-agnostic (relative paths), so the deploy
  path is not baked in.
- **What is missing for "installable, capable PWA":** a web app manifest, maskable icons, an offline
  app shell (precache + a `fetch` handler), an update-ready signal, an install affordance, and the
  optional background-sync capabilities. `index.html` today links only a favicon.

## B. The load-bearing constraint: one worker per scope

A browser runs **exactly one service worker per scope**. We already own scope `/` with the push
worker. We therefore **do not register a second worker**; the offline and lifecycle responsibilities
are composed **into the same bundled worker** at `src/sw/sw.ts`.

In practice the `install`, `activate`, and `fetch` handlers live **inline in `sw.ts`** beside the
existing push module (the file stays small enough that splitting them into separate files was not
needed), with the one piece of real logic, the per-request routing decision, extracted to a **pure**
`swCache.ts` (`classify()`) so it unit-tests in Node with no service worker:

- **`install`** opens a versioned cache and adds the precache manifest (the data-free navigation
  shell + the hashed JS/CSS/icons). It does **not** call `skipWaiting()` (see section E).
- **`activate`** deletes caches from prior versions. It does **not** call `clients.claim()`; the new
  worker takes control at the next navigation, the standard lifecycle (section E).
- **`fetch`** routes by request, per the table in section D, failing open to the network. The push
  module is untouched.

The precache manifest is generated at build time by a Vite plugin (`src/pwa/precachePlugin.ts`),
which writes `precache.json` (the hashed asset graph + shell) for the worker to fetch on install; we
do not hand-edit it, the same discipline visual baselines follow.

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
| `id`               | `./`                                                           | A stable install identity independent of the URL the app happens to be served from.  |
| `start_url`        | `./`                                                           | Base-agnostic (relative), so the install works wherever the app is served. No tracking query param (S5): install-vs-browser is detected client-side via `display-mode: standalone`, never a URL the page host could log. |
| `scope`            | `./`                                                           | Base-agnostic; navigations stay in-app at whatever path the app is served from.      |
| `display`          | `standalone`                                                   | No browser chrome; it reads as an app.                                               |
| `theme_color`      | `#2F9BB3` (teal-500)                                           | Accent; status bar tint.                                                             |
| `background_color` | `#FBF9F4` (warm-50)                                            | The app background, so the splash matches the first paint with no flash.             |
| `icons`            | 192 and 512 px, plus a `purpose: "maskable"` variant          | Maskable so Android does not letterbox the favicon mark.                             |
| `categories`       | `["health", "medical"]`                                        | Store and launcher categorization.                                                  |
| `description`      | One plain line: what it is and the privacy promise            | User-facing copy, voice-and-tone governed; shown by some install UIs.                |
| `shortcuts`        | Care, Share, People                                           | Long-press launcher entries to the three primary routes.                            |
| `screenshots`      | a narrow (mobile) capture, BUILT                              | Richer install UI on Chromium. The source of truth is a dedicated Storybook story (`PWA/Install screenshots`), and `scripts/screenshots/generate.mjs` screenshots it into `public/screenshots/`, so the manifest image stays in sync with the real UI. Fixture data only (S7), never a real session: no real badge or handle ships in a static asset. |

Icons derive from the existing `public/favicon.svg` (teal rounded square, white mark). The maskable
variant needs the mark inside the safe zone with the teal extended to the bleeders, so Android's mask
never clips it.

**Copy note.** The install dialog text comes from the OS, not us, but `name`/`short_name` are
user-facing strings and follow [voice and tone](21-voice-and-tone.md): plain, no jargon, no
internal words. Any in-app install nudge (section F) is fully governed by that guide.

`share_target` (BUILT) registers the installed app in the OS share sheet, so someone who receives a
passport link in a chat can Share it straight into sti.care. It is a real key-handling surface with
one sharp edge, so it is worker-backed rather than a bare manifest line:

- **The poison corner: the key is in the fragment, and `share_target` wants to put it in a request.** A
  keyed link is `/a/{id}#k={key}`, and the whole blind-store model rests on the AES key living in the
  URL **fragment**, which the browser never sends to a server (doc 16). But `share_target` delivers the
  shared string as **GET query params** (`?url=...`) or a **POST body** to the action URL, and a normal
  navigation to that action URL travels to the server. So a naive share_target would hand the blind
  store the very key it is engineered never to see, in `?url=https%3A%2F%2F.../a/{id}%23k%3D{key}`. That
  is strictly worse than opening a link the ordinary way, where the fragment stays on the device.
- **The fix: the service worker resolves the share entirely on-device, no network round-trip.** The
  action URL is same-origin and in the worker's scope, so the worker intercepts the request in its
  `fetch` handler (section D), reads the shared string locally, pulls a passport link out of it with
  the existing `parseAliasLink`, and answers with a **client-side redirect** to the in-app resolution
  route, reconstructing the `#k={key}` fragment in the redirect target. The shared string (key and all)
  is turned into a same-document redirect by the worker itself; **it is never fetched from the
  network**, so the key never leaves the device. This is the discipline section D already applies to
  the API origin (never forwarded), here applied to one same-origin action path.
- **Method choice: POST, `enctype=multipart/form-data`.** POST keeps the shared data in the request
  body rather than in a loggable action URL, and the worker reads it with `request.formData()`. A GET
  target would place the key in the action URL's query string, worse on every axis (in history, in any
  referer, and one worker miss from the network).
- **Fail closed; fall OPEN to the network never.** Once the handler is in control, anything off (a
  malformed share, a link with no fragment, a foreign host) degrades to the app's benign no-key/gray
  state and must NOT fall through to a plain network navigation that carries the key. This inverts the
  usual "fetch handler fails open to the network" rule for this one path, because here the network is
  the leak. The one case this cannot cover is a worker **not yet in control**: if the OS has read the
  `share_target` manifest member while this device's cached worker still predates the handler (a
  one-time window right after a release, before the worker updates on the next navigation), a share POST
  is not intercepted and the browser delivers it to the **static app host** that serves the shell, not
  to the blind store. That host is ours and never the API origin, so the key does not reach the blind
  server, but it does momentarily reach our hosting rather than staying on the device. The clean
  mitigation is a **phased rollout**: ship the worker handler in one release and add the manifest
  `share_target` member only in a later release, so every device that can see the member already runs a
  worker that intercepts. Shipping both together accepts that narrow window as a residual.
- **No new existence surface, best-effort on the fragment.** Resolving a shared link is byte-for-byte
  the same `/a/{id}` read as opening it directly, existence-uniform per doc 12; share_target only adds
  an OS entry point. Whether the shared string still carries `#k={key}` is up to the sharing app (some
  flows strip fragments); a keyless arrival simply resolves to gray, the same honest dead-link state,
  with no leak. Accepted residuals: the app appears in the OS "share to" list (the OS knows we handle
  links, not a server-visible fact), and the worker grows one more request shape, kept minimal and
  fail-safe per above.

Concretely: a manifest member (`{ action: "./share-target", method: "POST", enctype:
"multipart/form-data", params: { url, text, title } }`), and a worker handler that reads the form data
and `Response.redirect`s on-device (`swShare.ts` decides the redirect via the existing
`parseScannedLink`, strict about host and key shape; `sw.ts` intercepts the share POST and never
`fetch`es it, redirecting to the app root on a miss). The decisions are pure and unit-tested
(`swShare.test.ts`), with a manifest-test assertion of the shape, gated like the rest of the PWA work.

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
- **Adopt the update silently at the next navigation; never interrupt.** When a newer worker is
  installed and waiting (a worker reaching `installed` while one already controls the page),
  `registerSw` records it (`notifyUpdateReady`) rather than surfacing a banner. The router adopts it at
  the user's **next screen change**: `applyPendingUpdate` posts the waiting worker a `SKIP_WAITING`
  message (the ONLY path that calls `skipWaiting`, so activation always lands on a navigation boundary
  the user initiated, never mid-interaction); the worker activates, `controllerchange` fires, and the
  page reloads once onto the new version. Applying at a navigation rather than immediately also keeps a
  still-running old page from requesting a code chunk the new deploy has dropped. If the user never
  navigates, the waiting worker adopts naturally on the next cold start (standard lifecycle). No banner,
  no prompt, no copy. (Implemented in slice 3: `swUpdate.ts`, `registerSw.ts`.)
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

## F. Install affordance (progressive, never naggy), BUILT

- **Chromium (Android, desktop):** the `beforeinstallprompt` event is captured at app boot
  (`installPrompt.ts`, a small singleton, so it is never missed if it fires before a screen mounts)
  and the browser's own mini-infobar is suppressed. The app surfaces instead a **single quiet row in
  the Privacy/Controls section** (the settings surface), present only when the browser offered a
  prompt and the app is not already installed; tapping it fires the stored prompt. No modal, no hint
  that recurs. (`useInstallPrompt.ts`, `Privacy.install.tsx`.)
- **iOS Safari:** there is no install event, so install is manual Add-to-Home-Screen. We show brief
  A2HS guidance **only where it pays for itself**: iOS only allows Web Push inside an installed PWA,
  so the push toggle's own sub-line becomes the install hint when we detect iOS and not-standalone
  ("On iPhone, add sti.care to your Home Screen to turn this on."). Elsewhere we stay quiet.
- **Already installed** (`display-mode: standalone`, or iOS `navigator.standalone`): never prompt; the
  row and the hint both stay absent.

Copy is minimal and voice-compliant: lead with the benefit ("Keep your passport one tap away. It
works offline, and we still can't read it."), no preamble, no hype. Reviewed against
[21-voice-and-tone.md](21-voice-and-tone.md) before merge.

Once the native store apps ship ([26-native-apps-and-app-store.md](26-native-apps-and-app-store.md)),
this affordance narrows to platforms with no store app: on iPhone and Android the install offer
points at the store instead, one install story per platform. The PWA runtime (the offline shell, the
web app every shared link opens in) is unaffected.

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

**The queue is encrypted under the root key, and that constrains how it drains (S1).** The earlier
instinct, to treat it like the push context, is wrong: the push-context exception (doc 09) is
deliberately scoped to *low*-sensitivity inbox-read capabilities (read or clear the contentless
pending-nudge bit, never who, what, or when). The outbound ops are higher: a republish or revoke
carries the alias **write token**, a contact registration the **routing token**, and those exist
today only inside the root-encrypted blob. Putting them in a plaintext queue is a new
at-rest exposure for a thief-with-device (write tokens overwrite or revoke the owner's published
aliases), not an equivalent trade. So the queue is sealed under the root key like the blob it
mirrors.

That has a real mechanism cost worth stating plainly: a `sync`-event handler runs in the worker,
which **never holds the root key** (the key is never persisted). So a sealed queue cannot be
drained headless by the worker. The resolution: **the queue drains on the next unlocked, online
foreground**, not in a true-background `sync` event. Background Sync and the foreground flush both
just signal "there is work and the network is back"; the actual sealed-op replay happens with the
key in memory. We accept that write-bearing outbound ops do not flush while the app is closed; only
genuinely contentless, low-sensitivity ops (if any are ever added) may use a worker-drainable lane,
and only at the push-context sensitivity bar.

**The reconnect is jittered, not a synchronized burst (S3, BUILT).** When connectivity returns, the
backup drain (the blob push) and the inbox catch-up reads (section M) would otherwise fire in the
same instant, co-timing the account id with the contact inboxes. Each is instead scheduled with an
independent random delay (`reconnectJitterMs`, `lib/jitter.ts`), so they land at different times. The
republish was already server-side decorrelated (doc 18); this closes the gap for the blob push and
the reads. It is defense-in-depth: the blind server keeps no per-request trail (doc 12) and so does
not group them anyway, but the jitter denies a timing-only observer the burst.

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
3. **Update UX (BUILT).** Versioned shell cache and silent navigation-boundary adoption: a waiting
   worker is recorded and adopted via `SKIP_WAITING` at the user's next screen change, no banner and no
   automatic skipWaiting/claim (section E).
4. **Offline-created state (section H), BUILT.** This was the foundational change anticipated below:
   the encrypted blob is now cached in a root-key-sealed local store (`localBlobStore.ts`), and the
   sync (`offlineSync.ts`) reads **local-first** (so a reload restores the session offline) and writes
   **local-first then server** (`save` never throws offline; the edit is durable and the account is
   marked pending). `setOwnerState` keeps its online path but, on any server-step failure, persists
   the state change locally without throwing (aligning with decision 156's no-"couldn't refresh"
   rule). A reconnect drain (`useBackupSync`) re-applies the current state to push the blob and
   republish, in the foreground where the root lives (S1). A passive `NotBackedUp` marker shows
   while pending and clears itself on backup. Tested at the sync layer and against the real server
   (integration suite stays green). **Residuals (named):** minting a NEW share link and registering
   push still need the network (a viewer fetches the alias from the server), so those stay online;
   an expired link's server-side revoke lingers offline until reconnect (doc 16); and the reconnect
   drain re-publishes even after a profile-only offline edit (one extra decorrelated write, harmless).
   One more, named in full in section L: the blob push is **last-write-wins**, so two devices editing
   the same account while one is offline can have the reconnecting device overwrite the other's edit.
5. **Reconnect catch-up, RECONSIDERED (section M).** Periodic background sync is replaced by a
   reconnect/foreground inbox catch-up (`useCatchup`, BUILT) plus a recommended long-TTL push,
   which reach low-connectivity users without the device-initiated cadence leak. The timer is not
   shipped.

Slices 1 to 4 are built; slice 5 is reconsidered as a reconnect-and-foreground catch-up plus long-TTL
push (section M, both built; the catch-up's co-read is a server-mitigated accepted residual, analysed
in M, not a client TODO).

## K. Testing and gates

- **Manifest and icon invariants as an executable unit spec (BUILT).** `manifest.test.ts` asserts the
  manifest stays installable (standalone, hex theme/background, 192 + 512 + maskable icons that exist
  on disk, base-agnostic relative srcs) and that `index.html` links it with a matching theme color and
  an apple-touch icon. A regression that silently breaks "Add to home screen" fails the build.
- **Playwright** drives the real worker against a throwaway server (doc 14) and exercises offline
  (`e2e/resolution.pw.spec.ts`): one test installs the worker, goes offline, reloads, and asserts the
  app shell still renders (BUILT); a second opens a real blue card online (so a cross-origin API read
  definitely happens and could be cached), then enumerates every entry in every Cache the worker owns
  and asserts the shell **is** cached but **no `api.sti.care` URL ever is** (BUILT). That asserts the
  privacy invariant at its root, the fetch handler excludes the API origin so nothing from it is ever
  stored, which is steadier than driving the offline UI (you cannot serve from a cache what was never
  written to one). The pre-existing `client-gray-on-unreachable` separately pins the fail-closed-to-gray
  rule online (API blocked), and the server sends `Cache-Control: no-store` on `/a/{id}` so the browser
  HTTP cache cannot serve a stale blue either.
- **Unit:** the cache-routing decision (which strategy per request) is pure (`swCache.ts`) and tests
  in Node with no DOM, like the rest of the core (`swCache.test.ts`); the update flow is unit-tested
  (`swUpdate.test.ts`) and `fake-indexeddb` backs the store tests.
- **Installability via the browser (BUILT).** A third e2e (`resolution.pw.spec.ts`) opens the served
  app and asks Chrome, over CDP (`Page.getAppManifest`), for the manifest it actually resolved, then
  asserts it is well-formed and installable (a manifest URL was linked, no parse errors, standalone
  display, 192 + 512 icons). This catches what the static `manifest.test.ts` cannot: the manifest not
  linked, 404ing, or served with the wrong type. We assert installability through the browser directly
  because **Lighthouse removed its PWA category and installability audits in v12**, so a "Lighthouse
  PWA gate" is no longer buildable against current Lighthouse (and its `service-worker` audit fights
  our deliberate no-`clients.claim` lifecycle anyway). The CDP check is deterministic and reuses the
  e2e harness, with no extra dependency.
- **The standard gates** still apply: typecheck, lint, test, build, `build-storybook`, prettier,
  Go suite, no em dashes (CLAUDE.md).

## L. Security and threat surface

The PWA adds three new actors: a worker that intercepts navigations, a set of at-rest caches, and
optional background runners. This section is the single place a reviewer checks that they did not
weaken the project's invariants. The per-section fixes (S1 to S7) live where they bite; this
summarizes what holds and what residuals are accepted. S8 (below) is a residual named only here, with
no in-place fix yet.

**Invariants the PWA must preserve (and how):**

- **No `api.sti.care` response is ever cached** (section D), so no visit or existence trail at rest,
  and the existence-blind endpoints stay network-uniform.
- **Caches hold only the data-free shell** (S6), never an HTML response hydrated with user content.
- **The outbound queue is root-key sealed** (S1); write and routing tokens never sit in plaintext
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
- **Closed-app flush of write-bearing ops (S1).** Because the worker has no root key, sealed
  outbound ops flush only on the next unlocked foreground, not headless. Accepted in exchange for not
  exposing write tokens at rest.
- **Multi-device concurrent offline edits (S8): resolved by optimistic concurrency + a client merge.**
  The account record carries a monotonic version. The account PUT honors an optional `X-Version`
  precondition: a write naming a stale version is refused with `409` (the stored blob untouched, the
  current version returned); a write with no header stays an unconditional last-write-wins overwrite.
  The client (`offlineSync`) now caches the last-synced server blob as a common ancestor beside its
  working copy, records the server version, and sends it on every push. On a `409` it reloads the
  server's copy and **3-way merges** its edits onto it client-side (`blobMerge.ts`; the blind server
  cannot merge) before re-pushing, rather than clobbering the other device. The merge is biased toward
  safety: **delete wins** (a contact or alias revoked on either side stays gone, never resurrected by a
  concurrent edit), and on a true same-field divergence the **actively-used device wins** (the badge is
  recomputed locally and the owner can re-edit, so it is self-correcting). This is a correctness
  concern, not a privacy one: the blob is the owner's own data, so nothing leaks and no other user is
  affected. Named residuals: the in-memory session may briefly show the pre-merge value until the next
  load reconciles it (a reconnect already triggers one); the badge republish on a state edit reflects
  the pre-merge state until the next write; and the merge does not re-check cross-references (a
  `findable` whose alias was concurrently revoked simply fails to resolve, the same harmless state an
  expired link reaches).
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

## M. Slice 5 reconsidered: reach for low-connectivity users without the leak

Slice 5 was "periodic background sync." On a closer look it is the wrong tool for the user it would
most help, so this section replaces it. The persona is someone with **intermittent** internet
(limited data, rural, travelling). Their real need is not "poll on a clock"; it is **don't miss a
partner-notify** ("go get tested"), and **don't burn battery or data, and don't nag**.

**Why a timer fights itself here.** The security review's two leaks (S4) are a *cadence fingerprint*
(regular polling is a clock the server sees) and *co-read correlation* (reading all your inbox hashes
in one pass groups your contacts). The standard fixes, decorrelate the reads and add cover reads,
cost *more requests and more data*, which is exactly what this persona cannot spend. A fixed timer is
the worst of both: a fingerprint for the server and a data bill for the user.

**The better shape: catch up on reconnect, not on a clock.** A low-connectivity device is online in
*unpredictable bursts*, and that irregularity is the privacy feature: reads that fire on the user's
own reconnects have **no clean cadence to fingerprint**. So:

1. **Lean on Web Push store-and-forward (no new device actor) (BUILT).** The contentless cover-wake
   now carries a **long TTL** (`notifyWakeTTLSeconds`, 7 days, in `webpush.go`, up from 30 seconds):
   Web Push holds an undelivered wake and delivers it when the device next reconnects, within TTL.
   This reuses the existing server-to-device cover-broadcast (which already hides *which* device),
   stays contentless, and "just works" after hours or days offline, with no polling and no battery
   cost. Holding a contentless cover wake leaks nothing the push service does not already see (the
   endpoint and delivery timing). The only limits are the push service's TTL ceiling and the device
   having a subscription (iOS 16.4+ installed PWA qualifies). This is the biggest reach win and needs
   no periodic sync.
2. **Reconnect and foreground catch-up as the fallback (BUILT).** `useCatchup` re-pulls the owner's
   quiet inbox when connectivity returns OR the app comes back to the foreground (throttled, so rapid
   tab switches do not spam the read), reusing the existing foreground owner-pull, so it adds **no new
   cadence**. It covers the case where push is unavailable (declined, or an older platform). The
   RECONNECT read is jittered so it does not co-time with the backup drain (S3, section H); the
   FOREGROUND read is prompt, since the user is present and it is a single read, not part of the burst.

   **On the co-read residual, an honest correction.** The owner-pull reads the owner's per-contact
   inbox hashes together, which in principle groups their contacts. But the client-side mitigations
   that first looked appealing do not survive scrutiny: time-jitter is defeated by a server that
   groups reads by source IP or connection, and naive cover reads are defeated across pulls because
   the *real* inbox hashes recur every pull while fresh decoys do not (and stable decoys are still
   distinguished over time by the write pattern, since only a real inbox ever receives a ping). What
   actually protects the co-read is the **server's design**: it keeps no per-request trail and logs no
   id or IP (doc 12), so it does not group the reads in the first place; and the contact *count* is
   already a named, accepted residual (doc 13). So the co-read is treated as a server-mitigated
   accepted residual, not a client TODO. If the threat model ever tightens to a fully log-everything
   server, the only real client defense is **stable cover reads** (decoy inboxes that recur like real
   ones), with its own cost and the write-pattern caveat; it is documented here, not shipped, because
   it trades the low-connectivity persona's data for an imperfect gain.

**If a true background periodic poll is ever wanted** (app closed, online, push unavailable, a narrow
niche), the hard requirements to make it "safe enough" are: a **randomized, non-fixed cadence** (kill
the fingerprint), **decorrelated + cover reads** (kill the co-read), **per-pass sampling** (the rest
catch up via push or the next pass), **opt-in and off by default**, and **gated to charging +
unmetered**. The irony to state plainly: those mitigations spend the very data the low-connectivity
persona is conserving, so that path serves the *high*-connectivity-but-app-closed user, not the one
this section is about. Hence the recommendation: ship push-TTL + reconnect catch-up; do not ship the
timer.

## N. Open questions and residuals

- **`share_target`** (receive a shared passport link into the installed app), BUILT (section C): the
  worker resolves the share on-device so the fragment key never reaches the network. The remaining
  open call is purely product, not privacy: whether the OS-share entry point earns its keep in the UI.
- **Periodic sync vs push overlap.** Both can drive a background refresh. If push covers the need on
  the platforms that matter, periodic sync may not be worth the second background actor; revisit when
  push graduates from gated.
- **iOS install friction.** Manual Add-to-Home-Screen has real drop-off, and it gates push on iOS.
  Open question whether a one-time, dismissible explainer in the push-enable flow lifts it enough to
  justify the copy, or whether we stay silent and accept fewer iOS push opt-ins.
- **Precache size budget (BUILT).** The shell must stay small enough to install fast on a weak
  connection, so the precache plugin sums the precached files' bytes and FAILS the build when they
  exceed `PRECACHE_BUDGET_BYTES` (`precachePlugin.ts`), caught here rather than on a phone. Raising
  the budget is a deliberate, reviewable one-line change that surfaces the growth; dynamically
  imported chunks (the QR scanner) are excluded from the shell and so do not count against it.
- **Wallet passes vs install.** The live-status wallet pass (doc 02, doc 03) is the OS-native offline
  status surface; the installed PWA is the app surface. They are complementary, not a choice; keep
  the two from implying different freshness rules to the user.
- **The owner's offline self-view should be ratified in the decisions log.** Principle 1 reads the
  device as authoritative for the owner's own badge, so it renders fully offline rather than graying.
  This is the natural consequence of "client store is the source of truth" (doc 10), but it
  sharpens the decisions log's "fresh confirmed read" to be viewer-facing only. Worth a one-line decision
  entry confirming that scope so no future reader takes the decisions log to gray the owner's own screen offline.
- **Sync-staleness cue for the owner (separate from the badge).** Offline, the owner sees their true
  badge, but their *published* reflection (what viewers get) may lag until they reconnect. Whether to
  surface that lag at all, and how without implying anything about the badge, is an open call. Any
  such cue is app chrome, voice-and-tone copy, badge semantics untouched, and a deliberate
  decision-log change rather than something this doc bakes in.
