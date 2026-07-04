# sti.care: Demo mode

*The "let someone use the whole passport before they trust us with anything, and give an app reviewer
a way to test a blind, in-person app on one device." Upgrades the landing page's static sample card
into a real, navigable `@demo` passport that lives entirely on-device. Pairs with
[Native apps and the app stores](26-native-apps-and-app-store.md) (the App Review testability problem
this solves, section D2), [Vanity namespace governance](17-vanity-namespace-governance.md) (reserving
the `demo` name), [Data & storage](09-data-and-storage.md) (why the demo touches no server), and
[Voice and tone](21-voice-and-tone.md) (all copy below, which is illustrative until drafted for real).
Not legal advice.*

---

## In one line

The demo is the real app, running over an ephemeral on-device store with a locally simulated backend,
so every feature works the same. The only differences a person can feel are that it forgets everything
on reload and that it never touches the server or creates an account. It is permanently and
unmistakably marked a demo, so no one ever confuses it with a real passport, and it is the one artifact
that lets an app reviewer exercise every flow, including the in-person ones, on a single device.

## Three principles

1. **A demo is the product, not a screenshot.** Today the landing page shows a static sample card
   ([Landing.tsx](../../passport/src/ui/public/Landing.tsx): a `BadgeCard` tagged "Sample"). That is a
   picture. A person deciding whether to trust a sexual-health app with something sensitive should be
   able to **move through the real thing** first: see a badge, open a link, look at a connection,
   answer an ask, report a result and watch the badge change.
2. **It works the same; the one difference is it forgets.** The demo is the real app over an
   ephemeral, in-memory store with a locally simulated backend, so every feature behaves normally. The
   only things a person can feel are that it resets on reload and that it never touches the server or
   creates an account. That keeps it honest: a stranger can exercise every corner and nothing about
   them, or anyone, reaches the server.
3. **Unmistakably a demo, always.** A persistent label on every demo screen, plus the `@demo` handle,
   so no one confuses it with their real passport or with a real person, and an app reviewer knows
   exactly what they are looking at.

---

## A. What exists today, and the gap

The logged-out landing ([Landing.tsx](../../passport/src/ui/public/Landing.tsx)) offers
**"Claim your passport"** and **"See a sample card."** The sample is a single static `BadgeCard`
(handle `sam`, a "Sample" pill). It shows what a card looks like; it does not let anyone **use**
anything. So a curious user cannot feel how sharing, connecting, an ask, or reporting a result
actually work, and an app reviewer (doc 26, D2) cannot exercise the flows that make this app what it
is, because those flows are designed to need a second person in the room.

**The demo replaces the sample card on the landing** (section E): the static "look at this card"
affordance becomes a live "try the whole thing" entry, so there is one demo surface, not a sample card
beside a separate demo.

## B. The demo account: `@demo`, seeded

A single, fixed, synthetic account with the identity handle **`demo`**, recognizable on sight.

- **Reserve the name (doc 17 change).** `demo` is not in the reserved set today; add it (alongside
  `sti`, `care`, `health`, `verify`, `test`) so no real user can ever claim `@demo` and impersonate
  the demo. This is a small server reserved-list change with the existing blocklist test as its gate.
- **Seeded so every tab has something real**, loaded from a fixture set (the app already keeps
  fixtures, [ui/app/fixtures.ts](../../passport/src/ui/app/fixtures.ts)): a badge (show both a blue and
  a gray state so the meaning is legible), a couple of connections, at least one shared link, a
  **pending ask** to grant, a **group** to join, a gray peer link to **knock** on, and some Care
  content. The data is obviously synthetic (the handles are `@demo` and clearly-fake fixture peers),
  so nothing reads as a real person's status.

## C. Works the same, with one difference: it forgets

The demo is the **real app over an in-memory store with a locally simulated backend**, so the
functionality is not a cut-down subset. The single difference a person can feel is that it does not
persist: reload, and it is back to the seeded starting point.

- **Full feature parity.** Every screen and every action the real app has, the demo has: report a
  result and watch the badge move, share a link, open a connection, scan the canned peer to Connect,
  grant the pending ask, read an alert, browse Care. Nothing is greyed out or stubbed with "not in the
  demo".
- **The one functional difference is non-persistence.** Changes live for the session, so they survive
  moving between screens and cause and effect read normally, and they are gone on reload or exit. That
  is the only behavior that departs from the real app, and it is the right one: it is what makes a demo
  a demo.
- **The backend is simulated locally, not called.** No passkey, no recovery phrase, no account id, no
  write tokens, and no request to `api.sti.care`. Flows that in real life cross the server boundary (a
  shared link resolving on someone else's phone, pairing, a push wake) are answered by the local
  fixture instead, so they behave on one device with no second person and no network. For both a
  reviewer and a curious user, seeing the flow behave is the point; a real cross-device round trip is
  not, and is covered separately for review by a test account and the screen recording (doc 26, D2).
- **This is a testable invariant, not a hope:** a test asserts demo mode issues **zero** requests and
  creates **no** account (the promise backing in section H). That is also why the demo strengthens the
  privacy story instead of poking a hole in it.

## D. Never confused: demo and real stay unmistakably apart

"Works the same" raises the stakes on separation: the closer the demo feels to the real app, the
harder it has to work to never be mistaken for it. The rule is that a person can tell at a glance, on
any screen, even from a screenshot, whether they are in the demo.

- **A persistent banner on every demo screen**, not a one-time toast, anchored in the chrome so it is
  always in view. Illustrative copy (voice and tone to finalize): **"Demo. Nothing here is saved or
  sent."**
- **A demo identity that reads as fake:** the `@demo` handle wherever identity shows, and a distinct
  demo tint or watermark on the chrome so even a captured screenshot is obviously the demo, not a real
  card.
- **The entry reads as a demo invitation, not a shared status.** On the landing, the demo control is
  clearly a "try the demo" action, never a bare blue `BadgeCard` that a viewer could mistake for a
  status someone shared with them. This matters most on a phone, where a lone blue card fills the
  screen and could read as "someone sent me this" (the same confusion doc 29 guards on the viewer
  side). The label, not the card, leads.
- **Entry only from a place that can't be confused with your own data.** The demo opens from the
  logged-out landing, so a brand-new user starts it cleanly. If a logged-in user opens it, the demo
  fully swaps context behind the banner and offers a one-tap **"Leave demo"** back to their real
  account; it never overlays, mixes with, or writes to their real passport.
- **The reset is itself a signal.** Because reload returns to the seeded start, a user quickly learns
  this state is not theirs to keep, which reinforces the label rather than leaning on it alone.
- **An always-present, honest way out:** a standing **"Claim your passport"** so the demo is never a
  trap, and exiting starts real onboarding **carrying nothing across** (section G), with a plain line
  that the demo was not saved. Nothing a user did in the demo can surface in their real account, and
  nothing real is ever visible inside the demo.

## E. The two jobs the one demo does

- **For users: look around before committing.** A sexual-health app asks for trust up front; letting
  someone use a full, silent demo first lowers that cost honestly. On the landing page, this **replaces
  the static sample card**: the second action becomes, for example, **"Try the demo"**, and tapping it
  enters the live `@demo` passport rather than just showing a picture. That entry must read as a demo
  invitation, never a shared status card, especially on a phone (section D carries the rule and its
  reasoning).
- **For App Review (doc 26, D2): make a blind, in-person app testable on one device.** The reviewer
  opens the demo straight from the landing screen, with no credentials to manage, and every flow that
  normally needs a second person is pre-seeded with a canned peer so they can see both sides. The App
  Review notes point here, and a direct route (`/demo`) lets the notes deep-link it.

## F. The in-person flows, made testable on one device

This is the part that turns demo mode from a nicety into the answer for Guideline 2.1. Every flow a
lone reviewer cannot otherwise reach is answered by a **scripted second party**: standing state is
pre-seeded, and the interactive steps auto-respond, so the reviewer works one device with no demo-only
buttons and no waiting on a real peer. The flows, and how the demo scripts each:

- **See someone else's passport:** a canned peer card is in the seed, openable from the demo's
  connections, so "view a status" works with no second device.
- **Answer an ask (owner side):** the demo starts with one pending ask on a shared link. Approving it
  grants access and clears the row, so the owner's grant and its confirmation are both reachable.
- **Knock as a viewer (viewer side):** a seeded gray peer link starts closed. Opening it, asking, and
  reloading resolves the scripted approval, so the viewer's side of an ask, the wait, and the reveal
  all play out on one device.
- **Connect in person:** the accept and return legs run locally, so a mock Connect completes into a
  real two-way connection (both peers exchanged) rather than a half-linked stub.
- **Join a group as a member:** a public group is discoverable by handle; requesting to join is
  approved by the scripted admin, and the reviewer lands as an ordinary member (not an admin), so the
  member's side of group life is reachable.
- **Report a result:** applied locally, so the reviewer (and a user) sees the badge move, then it
  resets.

These are written verbatim into the App Review notes as the reviewer's script, so the demo and the
notes never drift.

**Intentionally not a solo flow: getting an alert.** A partner alert is one person telling another to
go get tested; there is no honest way to make a lone reviewer *receive* one without either faking an
incoming message or standing up a second party, and neither earns its keep. It would also set the
wrong tone for a first look: a brand-new visitor poking at the demo does not need to be told, out of
nowhere, that someone flagged them. So the alert intake stays inert in the demo, and the App Review
notes cover the alert path by description rather than as a hands-on step. The heads-up itself is
contentless by design (doc 09), so nothing about it is lost by leaving it out of the walk-through.

## G. Entry and exit

- **Entry:** the landing page **"Try the demo"** action, plus the stable `/demo` route for the review
  notes and for sharing a link straight into the demo. The whole demo runs under the `/demo` path
  prefix (`/demo/links`, `/demo/people`), so entering moves the URL to `/demo` and a reload stays in
  the demo; leaving drops back to the real root so the app is not stranded on the demo route.
- **Entry for development:** a build-time flag (`VITE_DEMO`) boots straight into the demo, so the whole
  app can be run and exercised with no server at all (the same simulated backend the demo ships with).
  This is a developer convenience, not a user surface; it only seeds the initial state, so the in-app
  **"Leave demo"** still drops to the real, logged-out app.
- **Exit to real:** the persistent **"Claim your passport"** drops the demo entirely and begins real
  onboarding. Nothing from the demo (no fixture data, no chosen result) carries into the real account,
  so a user cannot accidentally start their real passport pre-filled with demo state.
- **No bleed either way:** because the demo is in-memory and `@demo` is reserved, a real account can
  never be `@demo`, and a demo can never write to a real one.

## H. Privacy posture and the promises page

The demo **strengthens** the privacy policy, and the policy is the build-enforced Promises page
([promises.ts](../../passport/src/promises/promises.ts)), so it earns a promise of its own rather than
a paragraph of prose:

- **New promise (illustrative):** "The demo stays on your device. It makes no account and sends us
  nothing." Backed by a real test that demo mode performs no network requests and creates no account
  (a `kind: "test"` assertion, not reasoning, because it is checkable headlessly).
- It does not touch any existing promise: the demo is additive and silent, so "we can't read it",
  "no one can tell whether you've saved anything", and the rest are unaffected.

The broader set of policy deltas the native and cross-device work require (native push, secure
storage, pairing, Wallet) is tracked where those features live, in
[doc 26, section D5](26-native-apps-and-app-store.md). The rule there is the rule here: a new promise
ships **with** the test that backs it, never ahead of it.

## I. Build slices

Each is independently shippable; the static sample card stays until slice 3 replaces it.

1. **Reserve `demo`** in the server namespace (doc 17), with the blocklist test extended.
2. **Seeded demo account + sandbox store mode:** load fixtures into an in-memory session, short-circuit
   every server call in demo mode, and the no-network / no-account test that pins it.
3. **Label, entry, exit:** the persistent demo banner and watermark, the landing **"Try the demo"**
   action and `/demo` route, and the exit-to-claim that carries nothing across.
4. **The canned peer and the in-person script:** the sample peer card, link, and QR that make Connect,
   the ask, the alert, and view-a-status all reachable solo.
5. **Wire into the App Review notes** (doc 26) so the reviewer's script and the demo are one artifact.

## J. Open questions

- **Report-a-result in the demo: decided, it behaves like the real app** (applied locally, ephemeral),
  because the demo is meant to work the same and the badge moving is the most convincing thing it can
  show. Kept here only as the record of the call.
- **The demo peer's handle.** Use a clearly-fake fixture handle for the canned peer rather than a
  second reserved name; reserve only `demo`. Confirm the peer never reads as a real person.
- **Age and content framing.** The demo shows the same frank sexual-health copy as the app (doc 21),
  which the 17+ store rating (doc 26, D4) already covers; confirm the demo is inside that gate, not in
  front of it.
- **A shareable demo link: decided, `/demo` is public.** It is a real "try it" surface, not
  review-only, so it can be linked and shared. It carries no tracking, consistent with the no-tracking
  posture (doc 22, S5): the route is client-side and logs nothing.
- **Reset cadence: decided, it simply never persists.** Because the demo holds no server or shared
  state (section C), there is nothing to reset on a schedule: every visit starts fresh from the
  fixtures in memory, and a reload returns to that start. A periodic or daily reset would only matter
  if demo state were stored somewhere shared, and it deliberately is not, so non-persistence is the
  whole mechanism and the simplest one.
- **Localized fixtures.** If the app localizes later, the demo fixtures (handles, labels, Care content)
  localize with it; out of scope now, noted so the fixture set is not assumed English-only forever.
