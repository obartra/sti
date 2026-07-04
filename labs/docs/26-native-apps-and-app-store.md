# sti.care: Native apps and the app stores

*The "how the passport becomes an app you download from the App Store and Play Store, not just one you
add to your home screen." A plan for packaging the existing PWA as native iOS and Android apps with
the least new code, and for getting it through Apple review, which is the real risk. Pairs with
[Progressive web app](22-progressive-web-app.md) (the installable, offline-first base this builds on),
[Build, backend & deployment](10-build-backend-and-deployment.md), [Data & storage](09-data-and-storage.md)
(what may sit at rest on a device), the [Decisions log](02-decisions.md) (wallet/widget scope,
recovery passphrase, gray-never-stale-blue, all locked), and [Voice and tone](21-voice-and-tone.md)
(all the new copy below). Not legal advice.*

---

## In one line

We already ship a capable, installable PWA. Turning it into store apps is a packaging job, not a
rewrite: wrap the existing web build in a thin native shell (Capacitor), swap a few browser APIs for
native ones at the edges, and spend most of the real effort not on code but on getting a blind,
in-person, sexual-health app past Apple review.

## The one fact that sizes the whole thing

**The backend needs zero changes, and the UI needs none.** The server is a stateless JSON API
authenticated by an opaque `X-Write-Token` header, with no cookies, no sessions, no CSRF, no
same-origin assumption, and no server-rendered HTML ([10-build-backend-and-deployment.md](10-build-backend-and-deployment.md)).
The web app and server already deploy separately and talk only over HTTPS. So a native app is just
another client pointed at the same API. This is a client-packaging question, not a re-architecture,
and that single fact is what rules the cheap path in and the expensive path out.

## A. Three ways to package, and why we pick the middle one

| Path | What it is | Our code | Verdict |
| --- | --- | --- | --- |
| PWA store wrapper (TWA / WKWebView) | Ship the live PWA in a system browser surface | Unchanged | **Rejected.** iOS WKWebView does not reliably run Web Push or the WebAuthn PRF extension, so auth and notifications break on the platform that matters most. Apple also routinely rejects "just a website" under 4.2. |
| **Capacitor** | Bundle the built web app in a native shell with a JS-to-native bridge | **~Unchanged UI**, native plugins at the edges | **Chosen.** Reuse the whole frontend; call native APNs, Keychain, and native passkeys where the browser falls short. |
| React Native rewrite | Native UI driven by JS, no WebView, no DOM | **Rewrite all UI + Storybook** | **Rejected.** Months of rewrite for a forms-and-badges app that gains nothing from native-rendered widgets. |

**Capacitor in one paragraph.** It produces a real Xcode project and a real Android Studio project,
each a thin native app whose only screen is a full-screen system WebView. Our built Vite `dist/` is
copied into the app binary and loaded locally, so it launches instantly and offline by default. A
bridge lets our JavaScript call native code: our JS calls `Camera`, the bridge runs the real native
camera, the result returns to JS. Everything we already have (the hash router, the badge core, the
API client, the WebCrypto seal/open path, every screen, Storybook) runs as-is inside the WebView.
The work is concentrated at a handful of platform edges, plus the store-review prep that is the bulk
of the risk.

## B. What ports for free, and the edges that do not

WKWebView and Android System WebView both support `SubtleCrypto`, `fetch`, and IndexedDB, so the
crypto (PBKDF2 600k, HKDF, AES-GCM), the API client, the badge math, and the entire UI move with no
change. The cost lives in five edges.

| Edge | Web today | Native work | Risk |
| --- | --- | --- | --- |
| **Passkeys (WebAuthn + PRF)** | `navigator.credentials` with the PRF extension wrapping the account root ([passport/src/auth/passkey.ts](../../passport/src/auth/passkey.ts)) | iOS WKWebView WebAuthn is unreliable and PRF is bleeding-edge, so this needs a custom native plugin: ASAuthorization (iOS) and Credential Manager (Android), plus a native way to derive a PRF-equivalent secret to wrap the root key. May need a distinct native key-wrapping scheme. | **High. Spike this first.** |
| **Push** | Web Push / VAPID, with the service worker doing the contentless inbox-poll wake (doc 13) | Replace with APNs (iOS) and FCM (Android) via a push plugin. The contentless cover-broadcast design survives; the wake-then-poll logic moves from the worker into native push handlers. New key infra and Apple/Google config. | **Medium-high.** |
| **Service worker / offline** | Precache + offline shell (doc 22 slices 1 to 3) | Mostly deleted. The native shell bundles assets, so the offline-shell role goes away. The worker's **push** role migrates to native (above). The encrypted-blob and outbound-queue (doc 22 slice 4) logic is plain JS and stays. | **Low-medium.** |
| **QR camera scan** | `getUserMedia` + jsQR ([passport/src/ui/connect/QrScanner.tsx](../../passport/src/ui/connect/QrScanner.tsx)) | Works in the WebView with a camera permission string, or swap to a native scanner plugin for a better viewfinder. Add `NSCameraUsageDescription` and the Android camera permission. | **Low.** |
| **Secure storage** | `localStorage` (credential id, wrapped root) plus IndexedDB | Move the wrapped root and any write tokens into iOS Keychain and Android Keystore instead of WebView storage, which is unencrypted at rest (the one caveat doc 09 already names). Higher bar matters more for a store app. | **Low-medium.** |

Everything else (clipboard, QR generation, the recovery-phrase flow, all the screens) is free.

## C. Cross-device sign-in: add a phone, no phrase to type

This is the auth seam, and it is where a multi-device product usually gets ugly. It does not have to
here, because of one fact the code already enforces.

**The account is the root key, not the passkey.** The account root is derived from the recovery
phrase ([keyVault.ts](../../passport/src/auth/keyVault.ts), [the decisions log](02-decisions.md):
the passphrase is the required, no-PII root, the only way back in). Everything else (account id, the
blob key, write tokens) is HKDF'd from it. A passkey is explicitly **a second credential over the
same account**: its WebAuthn PRF output only **wraps** a local copy of the root so a reload skips
the phrase ([passkey.ts](../../passport/src/auth/passkey.ts), [deviceStore.ts](../../passport/src/auth/deviceStore.ts)
store only `{credentialId, wrappedRoot}`). So "the same passkey on every device" is the wrong goal.
Each device keeps **its own** local passkey wrapping the **same** root. Cross-device sign-in is
therefore one small problem: get the root onto the new phone, then let that phone mint its own
passkey. A passkey is bound to a relying-party id and never crosses platforms, but that no longer
matters, because it was never the thing we move.

### The design: "add a device" with one scan

**Full design and threat model in [Cross-device sign-in](27-cross-device-sign-in.md); the summary
here.** It is one scan: the old phone (already unlocked, so the root is in memory) shows a QR that
carries the account, and the new phone scans it once and mints its own local passkey.

1. **Old phone:** tap **"Add a device."** It shows a plain warning, then a QR carrying the root.
   Copy: **"Show this only to your own new phone. Anyone who scans it can get into your account."**
2. **New phone:** choose **"Set up from another phone"** and scan, with the existing scanner
   ([QrScanner.tsx](../../passport/src/ui/connect/QrScanner.tsx)).
3. The new phone confirms the code opens a real account (a wrong code fails closed), enrolls its
   **own** passkey, and lands signed in. The old phone clears the code as soon as the scan lands.

**The code is a bearer secret, in the same class as the recovery phrase**, so it is shown only on a
deliberate tap, briefly, pointed at your own phone. That is the explicit trade for one-scan
simplicity: no second scan, no ephemeral keys, and **no backend at all** (pairing reads only
`/acct/{id}` to verify; it writes nothing). The no-bearer-secret alternatives (a two-scan ephemeral
exchange, or a one-scan relay) cost more than a one-off in-person scan is worth and are recorded as
the upgrade path in doc 27.

### Fallbacks and edges, all of them honest

- **No second device, or remote setup:** the recovery phrase is always the floor. "Set up from
  another phone" sits next to **"Use my recovery phrase"**; pairing needs both phones present at once,
  which is the intended in-person gesture, and remote provisioning falls back to the phrase by design.
- **Same-vendor convenience** (platform-synced passkeys within one ecosystem) and **why OAuth is
  declined** are both covered in [doc 27](27-cross-device-sign-in.md) (sections D and G); not repeated
  here. The short of OAuth: it would leak that a person has an sti.care account at all and force a
  server-side escrow, so it is out.

## D. Apple review is the real project. The risks, ranked by what actually bites.

The engineering is low-risk. The review is not, and it is front-loadable. Risks below are ordered by
how likely they are to cause a rejection for *this specific app*.

### D1. Guideline 4.2, minimum functionality (the WebView tax). Highest risk.

Apple rejects apps that are "just a website in a shell." A WebView that only loads our PWA is a
near-automatic rejection. We are partly protected because we genuinely use native camera, push,
passkeys, and secure storage, which is exactly the native integration 4.2 wants to see. We harden it:

- Make native surfaces visible: native Face ID / passkey unlock, native push, the native share sheet,
  a native camera scanner.
- **Ship the Apple Wallet pass as the unmistakable native-value anchor.** It already exists as a
  locked, post-MVP fast-follow ([02-decisions.md](02-decisions.md), [03-design.md](03-design.md)).
  Native packaging is the reason to pull it into the first store release: a Wallet pass is a strong,
  unambiguous "this is a real app" signal. **Privacy boundary, carried over intact:** a live-updating
  pass pings the wallet provider on a schedule, a metadata channel acceptable **only for an
  already-public alias** ([03-design.md](03-design.md)), so a private user's pass must be static
  or absent, never a scheduled beacon. The pass is a native-value signal, not a new leak.
- Load the app from the bundled build, never a remote URL (a remote-loaded WebView trips both 4.2 and
  4.7).

The full catalogue of native surfaces that retire this risk, and that double as the way to make
connecting effortless, is **section E**. The short version: an App Clip connect code, the Wallet pass,
and widgets together make "is this just a website" a non-question.

### D2. Guideline 2.1, app completeness, the reviewer cannot test a blind in-person app. Sleeper risk.

Our core flows are designed to be unobservable to an outsider: no email or phone, passphrase-only
signup, and passports swapped **in person** between two people (doc 13, doc 16). A lone reviewer with
one device literally cannot exercise Connect, asks, or notifications, and Apple rejects what it cannot
verify. Mitigations, all of them:

- A **demo mode**, openable from the landing screen with no credentials, seeded so every screen
  (including the in-person flows) is reachable on one device. This is a real user-facing feature, not
  a review-only hack; full design in [Demo mode](28-demo-mode.md).
- The demo ships a **scripted second party** so the reviewer can, solo, view a status, answer an ask,
  knock on a link as a viewer, complete a Connect into a two-way connection, and join a group as a
  member. The reviewer's script and the demo are one artifact (doc 28, F).
- **Detailed App Review notes** that explain the privacy model and walk each non-obvious flow, plus a
  **screen recording** of the in-person Connect (Apple accepts demo videos for hard-to-reproduce
  features).
- Gate nothing critical behind a push that may never arrive in the review environment.

### D3. Guidelines 1.4.1 and 5.1.3, health and physical-harm scrutiny.

The badge says, in effect, "up to date and protected," and STI status is exactly the kind of data
where bad info could drive a real decision, so Apple gives it extra scrutiny.

- **On-surface disclaimers, in our voice:** the app is a personal record and a way to share, not a
  test, not a diagnosis, not medical advice, and not a guarantee about anyone's real status. Draft,
  voice-and-tone compliant (doc 21: plain, honest, lead with the outcome, no alarm): **"This is your
  own record and a way to share it. It isn't a test or medical advice, and it can't prove anyone's
  status for them."**
- Do not overclaim: no "verified," "certified," "HIPAA," or "guaranteed" unless literally true, and
  never imply the app tests anyone. (This is also just the doc 21 honesty rule.)
- Be ready to state plainly that this is an informational record and sharing tool, **not a medical
  device**, which keeps it out of SaMD / FDA framing.

### D4. Content misclassification (Guideline 1.1, age rating).

A reviewer skimming "STI, sexual health, share with partners" can misfile this as a hookup or
adult-content app. The content is health, not sexual content, and we make that obvious: an honest
**17+** rating (Apple's top bracket; the terms set actual eligibility at 18+, see
[doc 23](23-privacy-terms-and-trust-links.md), so the two are consistent, not in tension); description
and review notes that frame it unmistakably as a personal health record and disclosure tool, not
dating or matchmaking; no suggestive imagery in the icon or screenshots; no "find people nearby."

### D5. Privacy declarations (Guidelines 5.1.1, 5.1.2, plus the App Privacy label). Our strongest card.

We must ship a privacy-policy URL and complete the App Privacy questionnaire, and health data carries
the strictest handling rules. Our blind-server, no-PII, no-analytics design ([01-philosophy.md](01-philosophy.md))
means we can truthfully mark almost everything **Data Not Collected**, a clean, defensible label. The
one watch-out: if review sees network calls, we explain that the server only ever receives ciphertext
and opaque tokens (doc 09, doc 13).

**Point the store at the privacy policy that now exists, and let the guarantees stay build-enforced.**
There are two complementary public surfaces, both already shipped (see
[privacy, terms, and the trust footer](23-privacy-terms-and-trust-links.md)):

- The **privacy policy** at `/privacy-policy` (and `/terms`), plain-English, grounded in what the code
  does, reachable logged out via the sitewide trust footer, now on clean pushState URLs (not hash
  routes), which Universal Links and the App Clip can target directly. **This is the URL the App Store
  privacy field points to.** Its retention answer is concrete and already shipped: a backup untouched
  for two years is purged, disclosed in the in-app retention notice, so the App Privacy "data
  retention" entry has a real, honest value.
- The **guarantees page** at `/promises`, sourced from
  [promises.ts](../../passport/src/promises/promises.ts), where every guarantee unwraps into assertions
  that each name a real test and a CI check fails the build if a promise overclaims or names a missing
  test (the old static report generator was retired; this page is the single source).

So we do not hand-write a second policy that can drift: the store URL is the real `/privacy-policy`
page, and the guarantees page is the test-backed spine behind it. The per-feature deltas below still
land on `/promises`, each with its backing test.

**The rule for these new surfaces: a promise ships _with_ the test that backs it, never ahead of it.**
So "fold the changes into the policy" is concretely this set of deltas, each landing with its feature:

| Surface | What honesty requires | Backing |
| --- | --- | --- |
| **Native push (APNs/FCM)** | The notify stays contentless (the existing `contentless-notify` promise holds), but the OS push provider is a new metadata party that sees a delivery, so say so plainly rather than imply no one sees a wake. | the payload-is-contentless test still backs the claim; the OS-layer caveat is `reasoning`. |
| **Secure storage (Keychain/Keystore)** | A native "your sensitive data sits in the OS secure store" is a real strengthening over the at-rest caveat doc 09 names. | `reasoning` (a platform/structural property, hard to headless-test). |
| **Cross-device pairing (doc 27)** | "Adding a device moves your account phone to phone; the code is as sensitive as your recovery phrase, so show it only to your own new phone." Pairing touches no server beyond reading your own account to verify. | a test that pairing writes nothing to the server during the handoff (doc 27, J); the sensitivity warning is `reasoning`. |
| **Demo mode (doc 28)** | "The demo makes no account and sends us nothing." | a real test that demo mode does zero network and creates no account (doc 28, H). |
| **Wallet pass** | A live-updating pass pings the wallet provider on a schedule, so live updates stay public-alias-only and the metadata cost is disclosed (already locked in the design doc). | a test that a private alias's pass is static, plus `reasoning` for the disclosure. |

None of these reopen an existing promise; they are additive, and each is honest about its one new
metadata edge. That is the whole reason to keep the policy test-backed: the moment one of these claims
stops being true, the build says so.

### D6. The checkbox items that delay a build if missed.

- **Encryption export compliance.** We use AES-GCM, PBKDF2, HKDF, so we must answer
  `ITSAppUsesNonExemptEncryption`. Standard crypto protecting user data is normally exempt, but it
  must be declared in `Info.plist` or every build is held at submission. Low effort, guaranteed delay
  if forgotten.
- **In-app account deletion (Guideline 5.1.1(v)).** Account-based apps must offer in-app deletion. The
  server already has `DELETE /acct/{id}`; the app must expose a reachable in-app "delete everything"
  (already the right voice-and-tone button name, doc 21), not only "uninstall."
- **Push consent (Guideline 4.5.4).** The contentless wake is compliant; just request notification
  consent and never make push mandatory to use the app.

### D7. What is not a problem, so we do not spend effort on it.

- **Sign in with Apple is not required.** That rule triggers only with third-party or social login,
  which we do not offer. Passphrase plus optional passkey is fine.
- **In-app purchase (3.1.1):** not applicable until there is a paid feature.

## E. Native surfaces and frictionless connect

Two goals pull the same direction: make the app unmistakably native (so Guideline 4.2 is a non-issue,
D1) and make connecting between devices effortless. The highest-leverage move serves both.

### The headline: an App Clip / Instant App connect code

The real friction in connecting is that the other person does not have the app yet. An **App Clip**
(iOS) or **Instant App** (Android), launched from an **App Clip Code** (a combined NFC-and-QR mark) or
a plain QR, lets someone scan or tap and **see your passport and connect in seconds, with no install**.
They install the full app only if they choose to. This is both the strongest answer to "is this just a
website" and the biggest cut to connect friction, so it leads.

- **Privacy caveat to design in:** an App Clip's preview-card metadata is fetched by the platform from
  our domain, so the sensitive `#k=` key fragment must never ride that fetch. The card stays generic
  (no per-user data), and the key is consumed only on-device after launch, the same on-device
  resolution the shipped share_target already uses (doc 29). This is a real constraint on the App Clip
  URL design, not an afterthought.
- It pairs with **Universal Links / App Links** so an ordinary shared sti.care link opens the app or
  the App Clip directly instead of Safari.

### Connect transports, easiest first

These carry the same in-person connect payload (the contact invite, doc 25) or, for your own second
phone, the sealed pairing payload (doc 27). All of them move the payload **locally, never to the
server**, so they fit the blind store unchanged.

| Transport | What it gives | Honest caveat |
| --- | --- | --- |
| **App Clip / Instant App code** | Scan or tap, connect with no install, cross-platform | A separate native target, not a plugin; the card-metadata caveat above |
| **MultipeerConnectivity (iOS) / Nearby Connections (Android)** | Tapless: two nearby phones connect over local Bluetooth/Wi-Fi, no QR, no internet | Same ecosystem only (Apple-to-Apple or Google-to-Google); iOS-to-Android still uses the code |
| **NFC tap** (Core NFC + Android HCE) | Tap two phones, or tap a card or sticker you carry | iPhone-to-iPhone NFC peer push is not a public API, so this shines phone-to-tag and via App Clip NFC codes |
| **AirDrop / Nearby Share** | Send a connect link to someone next to you from the OS share sheet | Within one ecosystem only |
| **Universal Links / App Links** | A shared link opens the app or App Clip, not Safari | Foundational; required for the code path to feel native |

For your own second device, within one ecosystem **iCloud-Keychain passkey sync plus Handoff** can make
pairing nearly automatic, often removing the QR entirely; the local transports above can also carry the
**sealed** root behind the non-extractable re-unlock gate (doc 27).

### Native surfaces beyond connect (each retires more of the 4.2 risk)

- **Apple Wallet and Google Wallet pass** for the badge, the locked fast-follow and the single
  highest-leverage non-connect signal. Live updates stay public-alias-only (the locked boundary, doc
  03); a private user's pass is static.
- **Home- and lock-screen widgets** for the badge at a glance, and a lock-screen "connect" widget is
  the fastest entry into an in-person connect.
- **App Intents / Siri Shortcuts / Spotlight** for "show my passport" and "share my status."
- **Apple Watch / Wear OS** for the badge and a connect tap on the wrist (more work, very strong
  signal).
- **Live Activity / Dynamic Island** during an active connect, or a freshness countdown (a flourish,
  optional).
- Native **Face ID unlock, haptics on connect, and the native share sheet** are small textures that add
  up to "this is an app."

### The guardrails that keep all of this on-brand

- Local transports carry the payload **locally, never to the server**, identical to the blind-store
  model.
- **Widgets, Wallet, and Watch show the owner's own badge** (device-authoritative, correct offline),
  never someone else's stale status; live updates are **public-alias-only**, so a private user's
  surface never pings a provider on a schedule.
- **No Contacts and no Location access**, which keeps the app minimal and the store-review story clean.

### Cost, stated plainly

App Clips and Instant Apps are a **separate native target**, and MultipeerConnectivity and Core NFC need
**custom Capacitor plugins**; these are the higher-effort items, not free plugins. The Wallet pass and
widgets are comparatively cheap. The recommended order is the App Clip connect code and the Wallet pass
first (both goals, highest signal), widgets close behind, and the same-ecosystem tapless transports as
polish.

## F. Build slices

Each slice leaves a shippable, correct app, mirroring the doc 22 discipline. Slices 1 to 3 are the
spike and the skeleton; 4 to 6 are the substance; 7 is store submission.

1. **Capacitor skeleton.** Add Capacitor, generate `ios/` and `android/`, load the existing build,
   wire `vite build` to `cap sync`. Outcome: the current app runs in both native shells, online, with
   no edge work yet. Cheap, and it de-risks the toolchain.
2. **Passkey/PRF native spike (do this before committing a timeline).** Prove a WebAuthn-PRF-equivalent
   key-wrap works natively on iOS (ASAuthorization) and Android (Credential Manager). If clean, the
   rest is mechanical. If not, fall back to passphrase-unlock plus platform biometric-gated Keychain
   storage of the wrapped root. This is the single highest-risk line item.
3. **Secure storage migration.** Move the wrapped root and any write tokens into Keychain / Keystore
   (edge 5). Closes the at-rest gap that matters more for a store app.
4. **Cross-device sign-in (section C, doc 27).** The one-scan "add a device" flow: the old phone shows
   a QR carrying the root behind a warning, the new phone scans it, verifies it opens a real account,
   and enrolls its own passkey. No backend. Platform-agnostic, so it can land on web first and the
   native apps inherit it. Reuses the existing QR scan and generate primitives.
5. **Native push.** APNs and FCM via a push plugin, with the contentless wake-then-poll logic moved
   from the worker into native handlers, draining through the existing jitter and cover path (doc 13,
   doc 18). New key infra and Apple/Google console setup.
6. **Native camera scanner (optional polish).** Swap jsQR-in-WebView for a native scanner if the
   viewfinder UX needs it; otherwise the WebView path already works with a permission string.
7. **Native-value surfaces and the App Clip connect code (section E).** Bring the locked fast-follow
   Wallet pass into this release as the 4.2 anchor (honoring the public-only live-update boundary), add
   home/lock-screen widgets, and ship the **App Clip / Instant App connect code** (with the
   card-metadata caveat) as the no-install connect path. This slice does the most for both goals; the
   App Clip is a separate native target, so scope it deliberately.
8. **Store submission.** Demo mode and review notes (D2), disclaimers (D3), 17+ rating and framing
   (D4), privacy policy and App Privacy label (D5), the encryption declaration, in-app account
   deletion, and push consent (D6). This slice is where the review risk is actually retired.

Slices 1 to 3 prove feasibility. The honest critical path is slice 2 (passkey/PRF) and slice 8 (the
review gauntlet), not the UI, which is already done. Slice 4 is the cross-device UX and is worth
shipping on web ahead of the native work.

## G. Pre-submission checklist (priority order)

1. Ship one unmistakably native surface beyond the WebView (the Wallet pass is the highest leverage,
   and it is already a locked decision). Kills 4.2.
2. Build a one-device demo mode plus demo account and a canned peer QR, and record a Connect demo
   video. Kills 2.1.
3. Add the medical / non-diagnostic disclaimer in-app, voice-compliant. De-risks 1.4.1.
4. Write App Review notes that spell out the privacy model and every hard-to-test flow.
5. Set 17+ and frame copy and screenshots as a health record, not dating.
6. Publish a plain-language privacy policy; complete App Privacy as mostly "not collected."
7. Set the encryption declaration in `Info.plist`.
8. Verify in-app "delete everything" is reachable.

## H. Effort and the critical path

- **Recommended path:** Capacitor, reusing the existing web codebase.
- **Rough effort to ship both stores:** about three to four months for one mobile-capable engineer,
  or six to eight weeks with two, dominated by the passkey/PRF native plugin and push, plus the
  review prep, not by UI.
- **De-risk first:** a roughly one-week spike (slice 2) proving native PRF-equivalent key wrapping on
  iOS. If that is clean, the rest is mechanical.
- **What we avoid entirely:** any backend work, any auth-model redesign, any UI rewrite. The
  privacy-first architecture, which usually complicates things, helps here: no ad SDKs, no tracking,
  no server-side identity, so the store privacy forms are clean and honest.

## I. Open questions and residuals

- **Pull the Wallet pass forward?** It is a locked post-MVP fast-follow ([02-decisions.md](02-decisions.md)).
  Native packaging gives a strong reason to ship it in the first store release (the 4.2 anchor).
  Worth a decision-log line confirming that pull-forward, and reaffirming the public-only live-update
  boundary so a private user's pass never becomes a scheduled beacon.
- **Two install stories at once.** We would then offer both an installable PWA (doc 22) and store
  apps. Decide whether they coexist or the store apps supersede the PWA on mobile, and keep them from
  implying different freshness or privacy rules to the user.
- **PRF parity across platforms.** If the native PRF-equivalent secret differs in shape from the web
  PRF output, the key-wrap scheme may diverge per platform. Keep the passphrase-derived root as the
  single cross-platform root so a passkey is always only a local convenience, never a second root of
  trust.
- **Push key infrastructure.** APNs and FCM are separate from VAPID and from each other. Decide
  whether the contentless-wake cover-broadcast properties (doc 13) hold identically across all three
  transports, since the masking argument must be re-checked per channel, not assumed by analogy.
- **App Privacy label and network reality.** Our "Data Not Collected" claim is honest, but Apple may
  probe the network calls. Have the doc 09 / doc 13 ciphertext-and-opaque-tokens explanation ready as
  review notes, not just as design docs.
- **Rejection-round budget.** Even with all of the above, a sexual-health app on iOS may take a
  rejection-and-resubmit round. Plan the launch calendar with that slack rather than assuming a
  first-pass approval.
- **Cross-device belongs in the decisions log.** Section C (doc 27) sharpens the locked recovery-phrase
  decision (the passphrase is the root) with a concrete second way onto a device that never weakens it: the root moves phone
  to phone over the camera, never through a third party or an escrow. Worth a one-line decision entry,
  including the accepted trade that the one-scan code is a bearer secret in the recovery-phrase class,
  so a future reader does not reach for OAuth or a server-side reset to "fix" multi-device.
