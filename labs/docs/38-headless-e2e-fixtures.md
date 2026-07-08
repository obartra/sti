# 38 - Headless logged-in e2e: the passkey and camera fixtures

*How the Playwright suite signs into real accounts and scans real codes with no human, no
hardware, and no test-mode backdoors in the app. Extends the behavioral plane of
[Load & Usage Testing](14-load-and-usage-testing.md) from logged-out journeys to the whole
product. Pairs with [Stay signed in](24-stay-signed-in.md) and
[Account recovery](32-account-recovery-and-unlock.md) (the passkey model being exercised) and
[In-person connect](25-in-person-connect.md) (the design-stage flow this deliberately does not
build).*

---

## 1. Why: the two walls, and what they were hiding

The e2e suite drives a real browser through the real built app against a throwaway blind
store. Until this work it could only exercise logged-out journeys, because two product
choices (both correct) are walls for a headless browser:

- **Sign-up ends at a passkey.** Enrollment and login run real `navigator.credentials`
  calls, and the PRF output is load-bearing: it wraps the phrase-derived account root
  (doc 32), so there is nothing to stub short of the authenticator itself.
- **Connecting in person needs a camera.** The scan screen opens `getUserMedia` and decodes
  frames with jsQR; without a camera it honestly degrades to "no camera here", which is
  correct behavior and zero coverage.

Everything behind those walls (the owner's home, reporting, links, contacts, groups) was
covered only by unit and store-level tests, which prove functions compose but structurally
cannot catch usage errors: a flow that dead-ends, a payload a screen mints but the next
screen drops, a state no person could sensibly reach. Section 5 records one such error this
work surfaced immediately.

Both walls fall inside the browser we already drive, with no app change and no test flag:
Chromium ships a virtual authenticator and a fake media stack. The app keeps running the
exact production code paths.

## 2. The passkey fixture: a virtual authenticator over CDP

`e2e/support/webauthn.ts` attaches a virtual authenticator to a page via its CDP session:
`WebAuthn.enable`, then `WebAuthn.addVirtualAuthenticator` with:

- `protocol: "ctap2"`, `transport: "internal"`: a platform authenticator, matching the
  product's default enrollment (no attachment constraint, resident key required).
- `hasResidentKey: true`: the credential is discoverable, as enrollment requires.
- `hasUserVerification: true` + `isUserVerified: true`: enrollment and unlock both demand
  user verification; the fixture verifies silently.
- `hasPrf: true`: **the load-bearing option.** The auth model wraps the phrase-derived root
  with the passkey's PRF output over a fixed salt; enroll performs a create then a follow-up
  get that evaluates the PRF. An authenticator without PRF is, by design, a
  `no-prf` failure, so a fixture without this flag proves only the error path.
- `automaticPresenceSimulation: true`: every prompt is answered without a human.

One authenticator per browser context that needs an account. The credential store lives and
dies with the authenticator, which is exactly the "this device" scope the product assumes:
"keep me signed in" off plus a reload lands on login, and the passkey unlock then runs the
full PRF round-trip against the fixture.

## 3. The camera fixture: Chromium's fake capture pointed at our own codec

`e2e/support/qrVideo.ts` renders a URL into a Y4M video file: the module grid comes from
`encodeMatrix` in `passport/src/lib/qr.tsx`, the same encoder every share surface uses, drawn
as large luma blocks with a quiet zone. The scanner browser is launched with:

- `--use-fake-ui-for-media-stream`: the permission prompt auto-grants (Playwright's own
  permission layer sits in front of it, so the context also grants `camera`).
- `--use-fake-device-for-media-stream`: a fake capture device replaces real hardware.
- `--use-file-for-fake-video-capture=<file>.y4m`: the device plays our file on a loop.

The switch spelling matters: the device and UI fakes end in `-for-media-stream`, only the
file switch is `-video-capture`, and Chromium ignores unknown switches silently. With a
misspelled device switch the browser enumerates the REAL camera and, once permission is
granted, hangs against the OS camera prompt; that failure mode looks like a flaky scanner,
so it is pinned here on purpose.

The scan screen then behaves exactly as if a phone showing that QR were held up to the
camera: `getUserMedia` succeeds, jsQR decodes real frames, and the decode-and-route gate in
the store parses the payload. Because the QR content is a URL the app itself just minted
(read from the share surface in the test), the video is a faithful stand-in for the other
person's screen, not a synthetic fixture that could drift from the product's encoding.

One constraint shapes the scenario code: the capture file is a **launch-time** input, so the
scanning browser is launched after the scanned content exists. A two-person scenario
therefore runs two Chromium instances: the shower in the suite's default browser, the
scanner in a second one launched once the code is known.

## 4. One store, one build, one preview per run

The API base URL is baked into the build (`passport/src/config.ts`), so a built app and its
blind store pair one to one. Playwright's global setup (`e2e/support/globalSetup.ts`) boots
one throwaway Go store, builds the app once pointed at it, previews the build once, and
hands both origins to every spec through the environment; global teardown kills both. Every
browser a spec launches (including the fake-camera one) shares that pair. Isolation is per
account, not per server: each spec mints its own fresh accounts through the real sign-up
flow, which is both cheaper and more honest than reseeding a server per spec.

## 5. Scan parity: the usage error this work surfaced, and the fix

The share surfaces mint QR codes of **contact-invite links**: a keyed alias link plus, in
the fragment, the inviter's notify capability (`n=`) and, on a return leg, the alias id
being answered (`ref=`). The scan screen's stated contract is that scanning a code behaves
like opening the same link. It did not: scanning kept only the id and key, so a scanned
invite silently degraded to a read-only card with no way to add the person, while the same
link opened from a message offered "Add to contacts". No unit test could see this; each
layer was correct alone.

The fix is `parseScannedCode` in `passport/src/store/contactInvite.ts`: parse the scanned
text the way the router parses an opened link (the strict alias-link shape, plus the
contact-invite payload when present, both failing closed), and route the scan result with
the full payload. The safety posture is unchanged: a scanned code still never navigates
anywhere, still resolves only through our own api, and anything that is not a well-formed
passport link is still ignored while scanning continues. Group invites (`/g#g=`) have no QR
surface in the product, so the scanner ignoring them stays correct.

## 6. The journeys, and where they live

Specs follow the suite's existing shape: `passport/e2e/*.pw.spec.ts`, each pinning behaviors
in `src/loadlab/behaviors.json` and carrying the meta-test that fails when a pinned behavior
loses its test. Console errors and page errors are gated in every journey.

- **`e2e/auth.pw.spec.ts`**: sign up headlessly to a working home; with "keep me signed in"
  off, a reload lands on login and the passkey unlocks back in (the full PRF round-trip);
  the recovery phrase captured at sign-up logs into a fresh context (the new-device path,
  no authenticator present).
- **`e2e/connect.pw.spec.ts`**: two fresh accounts in separate browsers. One mints a named
  link and shows its code; the other scans it through the fake camera, accepts, and sends
  the return link back; the first opens it and connects. Both rosters then show the link
  both ways. A third fresh account then joins a group through its own invite link (a group
  invite admits the one person it was sent to; its lifecycle inbox carries a single accept)
  and all three see the same three-person roster after their catch-ups.
- **`e2e/smoke.pw.spec.ts`**: one session used like a person: sign up, report a result and
  watch the badge change, mint a share link, view it logged out from a clean context, and
  open the scan screen (which, in a camera-less browser, must degrade to its honest
  fallback, never a dead viewfinder). Every visited screen is swept for nonsense: raw
  placeholder artifacts (`undefined`, `NaN`, `[object Object]`, unfilled templates) and
  walked CTAs that go nowhere.

The camera-driven mutual link lives only in the connect spec; the smoke keeps the
camera-less degradation, so both sides of the scan screen's reality are pinned.

## 7. What this deliberately does not do

- **No app test modes.** The app has no flag, env var, or injected fake for any of this;
  the fixtures answer the production WebAuthn and getUserMedia calls.
- **No doc 25 build-out.** The two-QR simultaneous in-person connect is still design-stage;
  the return leg here completes the way the shipped product instructs (send the link back).
  When doc 25 lands, these fixtures are the harness it will be proven with.
- **No load-plane changes.** The wire/load lab of doc 14 is untouched; these specs join the
  same `npm run test:e2e` gate.
