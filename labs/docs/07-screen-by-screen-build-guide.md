# sti.care — Screen-by-Screen Build Guide

*The badge states are signed off (the proposal nailed it — two-state model, the four label
permutations, gray-carries-protection, uniform private/nonexistent resolution, and good calls
on all three open items). This document takes that approved card and walks **every real screen
in the build** from its current state to the target, so the agent can propagate the fork and
add the screens that are missing. Order follows the app's own module map.*

*How to read each entry: **Screen** (source module) · **Now** · **Target** · **Action**
(DROP-IN = the approved badge component replaces what's there; EDIT = copy/logic change;
REMOVE; NEW = build a screen/flow that doesn't exist yet).*

---

## Sign-off on the proposal (so the agent can build, not re-ask)

Approved as proposed: blue = DS teal (no new hue); single card design across states; **boolean**
temporal precision to anonymous viewers / "as of [month]" on owner-chosen public / exact dates
owner-only; **draft window (~30 min) then lock, post-lock delivery invisible to the user**;
condoms-only residual **accepted, not engineered away**. One global correction the proposal
already honors but every screen must inherit: **the protection labels are the new surface** —
"On HIV prevention" (umbrella, never splittable) and the 3-state condom preference (only "condoms always" qualifies) — they replace the old
freshness/streak/stamp furniture, they are NOT additive to it.

A note the agent flagged and is correct about: the live app still runs the old four-light model.
This guide is the propagation plan.

---

## A. Public / logged-out surfaces (`Pub`)

### A2 · Public passport view — `Pub.PublicCard`
- **Now:** Renders the four-light status; the **private branch shows a labeled "locked card"**
  ("@robin keeps test status private" + "Request access" + "People holding a private link can
  already see this status").
- **Target:** Exactly the approved **Resolution** cards. Authorized → full view (blue/gray +
  labels). Unauthorized/anonymous → **uniform gray-nothing, identical to nonexistent** (no name,
  avatar, "private," or request button).
- **Action:** DROP-IN the approved resolution states + REMOVE the locked-card branch entirely.
  The cold/anonymous/guessed view stays button-free. A *link-holder* who isn't authorized may see
  a **knock** affordance (see the Knock cross-cutting item) — the link is what reveals existence to
  them; the cold view never shows it. The button is gated on a **knock token in the link's URL
  fragment** (`#k=...`), so it renders for link-holders client-side with no server query that could
  leak existence; a bare `/p/<id>` with no fragment shows no button. Coarsen any date to
  **boolean** here ("in window / not
  shared"). **NEW: every rendered card (blue or gray) carries an identical "What does this mean?"
  tap** opening the no-account **stranger explainer** (design §12c) — this is the highest-traffic
  education surface (logged-out first-timers from shared links); it must live on this resolution
  page, not an in-app Learn tab. Gray-nothing is not a card and gets no affordance.

### A1 · Landing — `Pub.Landing`
- **Now:** Marketing copy includes "your card stays green," "all clear" framing.
- **Target:** Behavioral framing only. No green/clear/safe verdict language.
- **Action:** EDIT copy (see §Language sweep).

### A3 · Exposure alert — `Pub.Alert`
- **Now:** Anonymous "a recent partner tested positive" + PEP 72h block. Message body names
  "tested positive for an STI."
- **Target:** Contentless nudge — **"A recent contact suggests getting tested. It's quick and
  often free."** Never who/what/when/count. Keep PEP as an informational ramp (not a real-time
  alarm); lead PEP copy with the option ("PEP can still prevent HIV"), not the worry. Add the
  **free condoms** + **PrEP** finders alongside testing here.
- **PEP card display (on-device only; server triggers, client composes):** the PEP-urgency card
  is conditional on *locally-held* status, never a fetch.
  - **HIV-positive (detectable or undetectable)** → **suppress** (PEP can't help an existing
    infection).
  - **Reliably PrEP-covered** → **suppress urgency**, but keep the testing nudge (PrEP is HIV-only;
    other-STI exposure still matters).
  - **On PrEP with possible adherence gaps** → show a **soft variant** ("If you've missed doses
    recently, PEP may still be worth it — here's how to tell"), not full suppression.
  - **HIV-negative, not on PrEP / any genuine uncertainty** → **show** the PEP card.
  - **Anonymous pull "go get tested" page** (no trustworthy local status) → show PEP info
    **unconditionally** (nothing to gate on; gating would leak).
- **Action:** EDIT message body (strip "tested positive"/infection) + add resource ramps + wire
  the on-device PEP-display conditional (suppress/soft/show) against local status only.

---

## B. Onboarding (`Onb`)

### B1 · Claim account — `Onb.Claim`
- **Now:** "Pick a handle. Shown publicly, and permanent. Handles can't be changed later." The
  handle is the sole canonical identity, appears in every URL.
- **Target:** **No canonical public handle.** Default identity = opaque alias (opaque id in URL,
  display handle/avatar inside the encrypted payload). Aliases are multiple/revocable. Account key
  (passkey/passphrase) is the local anchor, never shown, never in a URL.
- **Action:** REBUILD the identity step. NEW: alias model + the just-in-time vanity-handle
  teaching ("findable, not unlinkable, points at your status") as an explicit public opt-in, not
  the default. This is the deepest change; pair with the architecture note in §G.

### B3 · First-run setup — `Onb.Setup`
- **Now:** Writes defaults: **`sharingMode: "public"`** (default-on) and a freshness/streak
  reward ("test monthly = extra-fresh," "Show testing streak" default true).
- **Target:** Default sharing **private/OFF**; public is a deliberate opt-in carrying the
  "watchable over time" warning. **No streak toggle, no monthly-reward** framing.
- **Action:** EDIT defaults (flip to private) + REMOVE streak/monthly-fresh setup steps.

### Avatar edit — `Onb.AvatarEdit`
- **Now:** Layered animal avatars. Fine.
- **Target/Action:** ALIGNED — keep. (Avatars live inside the encrypted payload, not as a
  server-side directory key.)

---

## C. Core app (`CoreApp`)

### C1 · Home — `CoreApp.Home`
- **Now:** Hero shows the four-light card with freshness meter; "All clear," "share a green
  light with confidence."
- **Target:** The approved blue/gray hero with protection labels; honesty sentence; no
  freshness meter, no verdict copy.
- **Action:** DROP-IN approved card + EDIT surrounding copy.

### Results (owner) — `CoreApp.Results`
- **Now:** Owner's private results, **does** show "Undetectable," test history, dates.
- **Target:** Keep as the **owner-only** detail surface — this is the one place "Undetectable,"
  exact dates, and treatment progress legitimately live. Must **never** be part of any
  share/preview surface.
- **Action:** ALIGNED in principle — add a hard guard/test that Results never feeds a viewer
  surface. EDIT: where it computes the badge, swap the four-light logic for the 3-route blue
  rule (90d + clear + active HIV protection; never-tested → gray).

### Care — `CoreApp.Care`
- **Now:** Testing finder + HeyMistr + CDC present and prominent. **No free-condoms, no PrEP
  finder.**
- **Target:** Four first-class ramps: **free testing** (keep), **free condoms** (NEW), **free/
  low-cost PrEP** (NEW), and **PEP** (CDC locator, added later). PrEP ramp is load-bearing since
  blue rewards active HIV protection. PEP's standing label is contextual, "after a possible HIV
  exposure," never a permanent urgency alarm.
- **Action:** NEW resource tiles (condoms, PrEP); keep testing.

### Notifications — `CoreApp.Notifications`
- **Now:** Lists **"@kai_ logged a linkup with you"** — names the logger (leaks the encounter +
  identity), inconsistent with the in-Connect anonymous framing.
- **Target:** **Linking is silent.** The contact is never told they were logged. Remove the
  notification + any add-back suggestion.
- **Action:** REMOVE the linkup-logged notification class.

---

## D. Core flows (`CoreFlows`)

### Report a result — `CoreFlows.Report` / `ReportSaved`
- **Now:** Input flow with "Undetectable," "treated syphilis stays positive → card stays green,"
  "your full panel is recorded as clear and your card stays green."
- **Target:** Input flow feeds the new 3-route badge logic. Capture the inputs the badge needs:
  **the standard core panel (HIV, syphilis, gonorrhea, chlamydia) results + dates**, **per-site
  GC/chlamydia coverage** (pharyngeal/rectal/urogenital, each "tested clear / positive / **not
  exposed here**" — not-exposed satisfies blue without forcing a swab), HIV route (PrEP /
  undetectable / **public-condom-commitment**), prior-treated-syphilis flag (serofast vs
  reinfection). A core-incomplete or exposed-site-missing entry does NOT earn blue (→ gray). The
  per-site data is on-device only and never surfaces to a viewer. Owner-facing copy fine; purge
  "green/clear" verdict words.
- **Action:** EDIT logic + copy. NEW inputs: the **core-panel + per-site capture** (with the
  "not exposed here" option per site), and the **3-state condom preference** (No condoms / Condoms optional / Condoms
  always), decoupled from blue; only "condoms always" shown publicly qualifies as
  the HIV-protection route.
- **Refinement (shipped).** No "all negative" one-tap shortcut: the flow opens straight into
  per-condition entry with **everything defaulting to "not tested,"** so a person states what they
  actually tested for rather than asserting a blanket clear. **Date tested is a real date input**
  (capped at today) wired to the panel day, so a back-dated test ages from when it was taken
  instead of reading as fresh. The flow **surfaces the HIV-protection route inline** (a PrEP toggle
  and a condoms-always toggle, writing the same owner state as Settings; undetectable rides in via
  the HIV result), since a clean panel alone never earns blue. A **live "what a blue card needs"
  checklist** shows the three requirements (recent full panel / clear / a route) and whether the
  result will show blue, computed from the same `badgeGates` the badge itself uses so it can never
  drift. The route a person sets here persists immediately, the same as in Settings.

### Let partners know — `CoreFlows.Partners` / `PartnersSent`
- **Now:** Report → review auto-built list → **"Send the heads-up"** or **"Pause for now"**
  (indefinite opt-out). K-anonymity hard-blocks at 1 recipient. Message names the infection.
- **Target:** **Draft → lock → delivery (mechanics invisible after lock).** After commit, the
  batch sits in a **draft window (~30 min, one config constant)** the user edits freely
  (add/correct/**remove**) and can **delete entirely** — removal is **frictionless**; delete-
  the-whole-report is the real safety valve. At the window's end the batch **locks** (historical,
  immutable). **Post-lock the app shows the user nothing** about timing, delivery, or recipients
  — no "sending in X," no delivery status, no counts, ever; the locked batch enters the server-
  side send cycle, which is never surfaced. Replace "Pause for now" with simple draft editing.
  Message is contentless. Rely on batching, not a hard per-user K (keep a gentle "one recipient
  can't be anonymous" note, don't hard-block).
- **Action:** EDIT flow (draft-window → lock) + EDIT message body + REMOVE indefinite "Pause for
  now" + REMOVE any post-lock delivery/timing/count readout + soften K from a block to a note.

### Privacy & sharing — `CoreFlows.Privacy`
- **Now:** Create/revoke named private links (good); links are effectively **until-revoked
  only**; copy implies a server-side handle directory ("stored against handles").
- **Target:** Keep create/revoke (revoke = no future reads). **Add expiry options; default new
  links to routine expiry (e.g. 30 days).** Make per-token/per-capability explicit (leaving one
  path never touches another). Strip copy implying a central directory.
- **Action:** EDIT (add expiry default) + copy fixes.

---

## E. Connect (`Connect.Connect`)

- **Now:** **Handle-only search** ("find someone by handle," "anyone can find @robin"), faves
  (cap 9), linkup logging by handle with relative non-editable dates. The audit calls this the
  clearest "central social graph / searchable directory" surface.
- **Target:** **No open handle search, no findable directory.** Linking is by shared alias
  link/scan only, member-initiated. Linkup logging: **encounter date defaults today, editable/
  back-datable, on-device, never shown to contact.** Add person-to-person **scan-to-autolink**
  (proposes a link both confirm; exchanges an alias, not a handle).
- **Action:** REMOVE handle search/directory + EDIT linkup (editable date, silent) + NEW
  scan-to-autolink flow.

---

## F. Circles & Events (`Circles1` / `Circles2`)

### CirclesList / CircleCreate / CircleJoin / CircleApprovals (`Circles1`)
- **Now:** Create sets **"Tested within the last N days" (the bar)**; join is link/code/QR +
  approval (good); no max cap (good); sticky-decline/rate-limit not evident.
- **Target:** **Remove "the bar"** as an entry threshold. Keep link/QR/approval discovery
  (member-initiated, link-scoped). Add **sticky declines + rate-limiting**; document **no
  max-group cap**.
- **Action:** REMOVE the bar + EDIT anti-spam.

### CircleDetail / CircleManage / CircleCheckin / CircleTransparency / CircleLeave (`Circles2`)
- **Now (status atoms):** Circle status math maps to the **four-light** set (`clear`=green,
  treat=amber...). Aggregate banner prints **exact counts** ("7 ready · 1 in treatment · 2 not
  shared") and a **worst-of room rollup.** **Door/check-in mode** is a bouncer screen with a room
  "Ready/Waiting" verdict. **CircleTransparency** prints per-circle **"N people notified."** No
  "additional private members" notice.
- **Target:**
  - **REMOVE Door mode / check-in entirely** (the most exclusion-coded surface).
  - **REMOVE all counts and the worst-of rollup.** After the blue/gray collapse, prefer a flat
    "everyone here shares a status" presence model, no health-state aggregation.
  - **Add the universal "there may be additional private members" notice** to every roster/
    aggregate, always.
  - Per-member dots only among the viewer's authorized peers; never a contrast that reveals who
    hasn't shared. Min group size ~5 (keep).
  - **CircleTransparency:** drop per-circle counts; **merge circle exposure into the same
    contentless partner-notification pipeline** rather than a separate channel.
  - Leave/kick: the affected person can tell their own access ended, but **"left" and "was
    removed" look identical to other members** (no public removal mark, no reason).
- **Action:** Big one. Swap the status atoms to blue/gray (DROP-IN), REMOVE Door mode + counts +
  rollup, NEW "private members" notice, EDIT transparency into the main pipeline.

---

## G. Cross-cutting (touch many screens)

### Handles, not names — every card, circle, wallet, share, profile
- **Now:** Cards show person names ("Sam Rivera," "Robin Vale").
- **Target:** Display identity is a **handle/alias + avatar — never a real name.** No name field
  exists anywhere (not stored, not optional, not hidden). Replace every name display with a handle
  (e.g. "@sam_r") + avatar; remove any name input.
- **Action:** Global EDIT (display-only this pass; the deep alias model is P2-identity). A name is
  a collection surface the system has no use for — the field shouldn't exist.

### Status logic & tokens — `Circles2` store, `card.jsx` (`PassportCard`), copy.js STATUS
- **Now:** A four-value status enum (clear/treat/expired/none) drives every surface.
- **Target:** Collapse to **blue/gray** with the 3-route blue rule; gray is one flat bucket. The
  approved `badge-card.jsx` is the single source of truth — propagate it; delete the four-light
  `PassportCard` variants (A/B/C/D) and the freshness meter.
- **Action:** DROP-IN the forked card everywhere a status renders; REMOVE the old enum's
  viewer-facing tiers.

### "Self-reported" stamp — every card header, Circles banners, Door
- **Now:** Rotated rubber-stamp + "Source: Self-reported" field, repeated across surfaces.
- **Target:** **No mark anywhere.** One plain, low-reading-level sentence under the name: *"[handle]
  says they've tested recently and take steps to prevent HIV. They're telling you themselves — it's
  not a lab result."* Plus an identical "What does this mean?" tap on every card (blue or gray) to
  the stranger explainer (design §12c). Reserve no space for a future "verified" chip.
- **Action:** REMOVE the stamp/field globally.

### Testing streak — `card.jsx` StreakStrip/Grid, Setup
- **Now:** Heatmap + "day streak" on the shareable card, default on; sold as "the collectible
  hook."
- **Target:** **Removed from every viewer surface.** Any "you test regularly" affirmation is
  owner-only, non-competitive, non-streak.
- **Action:** REMOVE from viewer surfaces (do not recolor).

### Language sweep — copy.js, everywhere
- **Ban (viewer-facing):** clear, all clear, green, "stays green," safe, healthy (as status),
  disease-free, on the mend, needs a fresh test, results expired, waiting, verified, "negative"
  as identity.
- **Use:** "Tested & on HIV prevention" or "Tested & always uses condoms" (route-specific blue headline), "On HIV prevention," the 3-state condom preference, "No status shared right now" (gray).
- **Keep allowed:** "negative" as a clinical result **input**; "healthy" inside clinical
  **education** copy (the UU explainer's "live a long, healthy life" is fine).
- **Action:** EDIT the STATUS/statusCopy strings + all headlines.

### Wallet — `Wallet.Wallet`
- **STATUS (deferred / hidden, 2026-06-20):** the wallet screen + Apple/Google pass renditions are
  built (`passport/src/ui/wallet/`) but the entry point is GATED OFF behind
  `passport/src/features.ts` `WALLET_ENABLED = false` (the ShareSheet "Add to wallet" row is hidden
  in the app; the component story still renders it). Reason: real passes need signing credentials we
  do not have yet — an Apple PassKit pass-type certificate and a Google Wallet issuer account +
  service-account key, plus a server-side signing step — so a shipped "pass" would be a
  non-functional mock. Re-enable by flipping the flag and wiring the signer; no code was deleted.
- **Now:** Apple/Google Wallet renditions of the four-light pass with the scannable status QR.
- **Target:** **Format choice gated by privacy mode.** **QR format** (any alias) shows **no
  status** on the face — QR + handle + avatar + logo, a link carrier; resolution gates downstream.
  **Live-status format** (public aliases only) shows blue/gray + auto-updates; turning it on
  forces/confirms public. **Fail closed to gray** (freshness window 24h) — staleness or unreachable server → gray, never
  stale-blue; no distinct stale state, no owner "couldn't refresh" message. Boolean precision, no
  freshness/streak/stamp/name; handle + avatar + logo. URL rendered as text beside the QR
  (public/QR-carrier only); QR/URL encode an alias, never a cross-linking id. Build all three:
  Apple pass (both formats), Google pass (both formats), standalone shareable card.
- **Action:** REBUILD passes (two formats) + EDIT QR target to alias. (May propose-first if large.)

### Architecture the UX must stop contradicting — `Connect`, `Privacy`, store copy
- **Now:** Copy and a searchable directory imply a **central social graph** ("always findable,"
  "stored against handles").
- **Target:** UI must imply on-device graph + ciphertext-only server. No global search, no
  "anyone can find you," no "stored against your handle" directory language. No account to view
  a public alias.
- **Action:** EDIT copy + REMOVE directory affordances (covered per-screen above; listing here
  so it's tracked as one architectural through-line).

---

## New screens / flows that don't exist yet (NEW)

1. **Pause** (manual + auto) — there is no pause concept today; treatment is wrongly shown as
   amber. Build: manual "hide my status," on-device auto-pause from a logged positive's clearance
   window, both rendering as ordinary gray; owner sees private un-pause date, viewer never does.
2. **Condom-route public commitment** — the toggle in Report that, when chosen as the HIV-
   protection route ("condoms always", shown publicly), qualifies the user for blue. The other
   two condom states are displayable preferences that never affect the badge.
3. **Scan-to-autolink (person-to-person)** — mutual-confirm, exchanges an alias.
4. **Alias management** — create/name/revoke multiple aliases; the vanity-handle public opt-in
   with just-in-time teaching.
5. **Free condoms + free PrEP finders** — resource tiles in Care and on the exposure alert.
6. **Operational metrics (engineering, invisible)** — aggregate, identifier-free, no third-party
   SDK near health surfaces (see the separate metrics note).
7. **Wallet/QR/shareable card** — format choice gated by privacy mode (QR-carrier any alias / Live
   public-only), fail-closed-to-gray at a 24h freshness window; public-profile share is a resolving
   link/QR, not a baked-in status image. (Wallet apply pass; see the Wallet entry above.)
8. **Knock — stranger access to a private profile** — a link-holder can request access; the owner
   reviews (never auto-grant). Existence-safe by uniform response ("if this passport exists, your
   request was sent" — identical for real/fake/guessed ids). Requester gets no pending/granted/
   denied signal. Owner alerting = quiet persistent indicator on the alias (no per-knock push).
   Knocks are contentless, rate-limited, auto-expire ~4 days, with a "clear all." The cold/guessed
   view shows no knock affordance; the button is gated client-side on a **knock token in the link's
   URL fragment** (`#k=...`), so a link-holder sees it with no server query and a bare `/p/<id>`
   does not (Design §Knock). (Its own pass, propose-first.)

---

## Suggested build order (lowest risk → deepest)

**P0 — leaks & verdicts (do first):** four-light → blue/gray collapse (DROP-IN the approved
card everywhere); remove Door mode + circle counts + worst-of rollup; remove the linkup-logged
notification + "tested positive" in the alert; fix the PublicCard locked-card → uniform
resolution; remove the "Self-reported" stamp; language sweep.

**P1 — defaults & gaps:** default sharing → private; add pause; add condoms + PrEP ramps; add
the "additional private members" notice; add link expiry default; soften partner-notify K to a
note; draft→lock partner flow with post-lock invisibility.

**P2 — identity re-architecture (deepest):** opaque aliases replacing the canonical handle;
remove handle search/directory; alias management + vanity opt-in; scan-to-autolink; the on-device
graph the UX must imply.

**P3 — finish:** streak removal everywhere; Wallet two-state; metrics; clinical "active
infection"/syphilis-serofast handling.

---

## Carried-open (don't block; propose)

- Temporal precision (boolean / "as of [month]" / exact) — **proposal accepted**, confirm.
- Notification draft-window length (~30 min) + send-cycle cadence — confirm.
- Condoms-only label residual — **accepted, flagged**, confirm.
- Clinical: **RESOLVED** — badge reflects current state not diagnosis history; chronic HSV/HPV →
  education only (never grays/labels), transient HSV outbreak → pause, testing recency → 90-day
  clock only; syphilis serofast keeps clear, reinfection breaks it. (Build per decisions + design
  §1/§2/§12b; see prompt-4-finish items 4 + 4b.)
- The badge-equity values call (detectable-poz can't reach blue; PrEP-decliners) — **for
  outside review**, not a build decision.
