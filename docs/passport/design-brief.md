# sti.care — STI Passport · Designer Prompt

A self-contained brief you can hand to a human product designer **or** paste into
an AI UI tool (v0, Lovable, Figma AI, etc.). It assumes the existing `sti.care`
brand and extends it. Build the MVP scope; design with the roadmap in mind.

---

## 0. The one-line pitch

> A pocket "STI passport." You self-report your test results; the app turns them
> into a single shareable traffic-light card that proves you're current and clear
> **without ever revealing what you tested for.** When something comes back
> positive, it quietly and anonymously nudges your recent partners to go get
> tested — and points everyone toward real care.

---

## 1. Non-obvious design principles (read these first)

These are the decisions that make the product good. Don't lose them.

1. **The Card is the hero.** A passport / boarding-pass object is the central
   metaphor and the unit of sharing. Every screen orbits it. It should feel
   collectible, proud, screenshot-worthy — never clinical or shameful.

2. **Logged-out reveals nothing but the signal.** The public card is
   deliberately information-poor: **one light, one short line, one relative
   timestamp, one CTA.** No conditions, no test dates, no history, no identity
   beyond what the owner explicitly chose to show. The privacy wall is a feature,
   not a limitation — make it visible and reassuring.

3. **Color is never alone.** This is a red/green system used by people with
   red/green color-blindness, in sunlight, on cheap screens. Every status =
   **color + icon + distinct shape + word.** Status must survive a grayscale
   screenshot. (WCAG 2.2 AA minimum.)

4. **Honest about "self-reported."** The UI must _never_ imply a result was
   verified. A calm, persistent "self-reported" marker lives on the card.
   Roadmap: a higher "clinic-verified" badge tier — design the card so a verified
   tier can slot in later without a redesign.

5. **Status decays over time.** Green is not permanent — it ages to red as the
   last test gets stale. Show the decay ("fresh for 23 more days") because the
   countdown is the thing that nudges the healthy behavior: **test again.**

6. **U=U is handled with pride, not pity.** Undetectable HIV (and other
   managed-chronic states) is **not** red and **not** "infected." It reads as a
   green-equivalent "managed · untransmittable" state, consistent with the
   existing `/poz` card. Never pathologize a managed condition.

7. **Partner notification is consent-gated and ethically guarded.** It is
   _prompted_ automatically on a positive report, but a human always confirms
   before anything sends. It is genuinely anonymous, non-accusatory, and
   shame-free on both ends. Guardrail: warn / soften when the recipient set is so
   small that "anonymous" wouldn't actually be anonymous (k-anonymity).

8. **Guidance is contextual.** The "next best action" changes with the status:
   red → _get tested_ (clinic map + Heymistr), yellow → _finish treatment / when
   you'll be clear_, green → _stay current, here's your reminder_, exposed →
   _book a test now._ Never a dead end.

9. **Designed for the roadmap, scoped for the MVP.** Reserve the nav slot and the
   social-graph primitives (a partner/contact list already exists implicitly for
   notifications) so "find connections" and a map view can land later — but do
   **not** build discovery now. Ship the passport + notification + guidance loop.

---

## 2. The status system (lock this exactly)

The **public** card can only ever be in one of these states. It is a pure
function of: freshness of last full panel, any active treatment, and whether the
owner shared anything. It **never** names a condition.

| State                  | Color (semantic)          | Icon / shape            | Headline             | Subline (examples)                   | Means                                                                                             |
| ---------------------- | ------------------------- | ----------------------- | -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 🟢 **Current & clear** | green (lime)              | shield + check, rounded | "Up to date"         | "All clear · fresh for 23 more days" | Full panel within the freshness window, nothing active. Includes U=U "managed · untransmittable." |
| 🟡 **In treatment**    | amber (yellow)            | clock / plus, hexagon   | "On the mend"        | "In treatment · clear by Jun 13"     | A curable positive with treatment logged; shows a countdown to the clear date.                    |
| 🔴 **Out of date**     | red (dedicated alert red) | refresh / bang, octagon | "Needs a fresh test" | "Last results expired"               | Last test older than the freshness window.                                                        |
| ⚪ **No status**       | gray                      | dash / question, square | "No status shared"   | "Hasn't shared a status yet"         | Account exists but nothing reported, or owner set the card private.                               |

**Important product/ethics decision to confirm (flagged for the team):** there is
deliberately **no public state that announces "currently positive / contagious"
by name.** Outing a specific active infection on a shareable link is a stigma and
safety risk. So a positive that isn't yet in treatment simply makes the card
**not green** — it shows "No current all-clear" (gray) until the person engages
treatment (→ yellow) or re-tests clear (→ green). Privately, that same person is
guided straight to treatment + partner notification. Design both the public
(non-disclosing) and private (fully-informed) views around this rule.

Freshness window is configurable (default 90 days; let the user pick 30/60/90 in
settings). Show the window everywhere it matters.

---

## 3. Page & view inventory

Group A is public (logged-out). Group B is auth/onboarding. Group C is the
logged-in core (the MVP). Group D is roadmap — design-aware, do not build.

### A. Public (no account, reveals only the signal)

- **A1 — Landing / value prop.** What the passport is, the privacy promise, one
  primary CTA ("Claim your passport"). Show a sample card. On-brand hero.
- **A2 — Public passport card** (`sti.care/p/{token}` and optional `/@handle`).
  The shareable view. Renders **only** the status light + headline + subline +
  relative "updated 5 days ago" + "self-reported" marker + a soft CTA "Get your
  own." Nothing else. This is the screen people screenshot — make it beautiful.
- **A3 — Exposure alert landing.** Where an anonymous "one of your recent
  partners tested positive — worth getting checked" link points. Calm, zero
  blame, zero panic. Leads with _what to do_ (find testing / Heymistr), explains
  it's anonymous and may be a precaution, and offers "claim your own passport."
  This page does the most emotional work in the app — design it with the most
  care.

### B. Auth & onboarding

- **B1 — Claim account / sign up.** Lowest possible friction (email or phone
  magic link / passkey). Pick a handle. State the privacy promise up front.
- **B2 — Sign in.**
- **B3 — First-run setup.** Explain "all data is self-reported," set the
  freshness window, set privacy defaults (card public vs link-only), opt-in
  framing for partner notifications. Optionally log the first result now.

### C. Logged-in core (MVP)

- **C1 — Home / dashboard.** Your big status light front and center, plain-English
  "what this means," the single **next best action** for your state, and quick
  actions: _Report a result_, _Share my card_, _Get care_.
- **C2 — Report a result** (the engine that drives the whole state machine).
  Pick condition(s), result (negative / positive / undetectable), date tested.
  If positive → treatment status + expected clear date (→ drives yellow + the
  countdown) → then surfaces the partner-notification prompt (C5).
- **C3 — History / timeline.** Your private log of results over time. Owner-only.
- **C4 — Get care / Resources.** Contextual to your status. **Heymistr**
  telehealth deep-link and **free clinics near me** (list + map, reuse the
  existing CDC "find testing near me" pattern). Frame as guidance, not nagging.
- **C5 — Let partners know** (partner notification, sender side). Auto-prompted
  after a positive report but always human-confirmed. Show how many people will
  be notified, the exact anonymous message they'll get, channel choices, the
  k-anonymity guardrail, and an easy decline. Non-accusatory throughout.
- **C6 — Privacy & sharing settings.** Card public vs link-only, manage/revoke
  share links, what "anonymous" means in plain words, export, **delete
  everything.** Trust lives here — make it generous and legible.
- **C7 — Account / profile settings.** Handle, language (en/es/pt/fr),
  notification prefs, sign-out.

### D. Roadmap (reserve space, do NOT build)

- **D1 — Find connections / hookups** (mutual opt-in only).
- **D2 — Map view.** Leave a disabled/"coming soon" nav affordance so the IA
  doesn't have to be re-cut later.

### E. Circles & Events (roadmap-after-MVP — leans on the passport + notification primitives)

Private groups (a recurring crew / polycule) or dated **Events** (a party).
Members self-register, are **host-approved**, then opt to share their status with
the group. Neutral naming throughout — "orgy" never appears in the UI (discretion
on lock screens + notifications).

**Per-member status dot** — three tones, each always paired with a glyph + text
label (never color alone):

- 🟢 green + ✓ — "Ready" (clear and within the group's bar)
- 🟡 yellow + clock — "In treatment"
- ⚪ gray + dash — "No current status" (not shared, expired, or out of date)

**Aggregate = the worst (lowest) status present** among approved members.
Severity best→worst: green → yellow → gray. So 20 green + 1 yellow = **yellow**;
any gray present = **gray**. The circle banner shows color + icon + word + counts.
(The passport's "out of date" red collapses into gray for circles, per the
three-tone dot.)

**Roles:** Organizer/Admin (owns; edits the bar + expiration, assigns roles,
approves members, deletes) · Gatekeeper (member with gating rights: approve/deny

- run check-in) · Member/Attendee (joins after approval, shares status, leaves
  anytime). Role badge on each roster row.

**Always-on exposure notification:** a positive result auto-notifies all circle
members anonymously via A3. The notify set is **live during the window** (positive
result → treatment logged clear) — people who join, or new invite links created,
in between get caught up on the **next** send. **Removing** someone does _not_
retract a notice already sent.

**Optional expiration date:** circles/events can expire; on expiry they
auto-archive (roster + sharing stop). Dated events show a countdown.

- **E1 — Circles & Events list.** Each row: name, type/date, member count,
  aggregate dot + label; "+ Create"; empty state.
- **E2 — Create circle / event.** Neutral name; type (ongoing circle vs dated
  event); the **bar** (freshness window + requirement); **optional expiration**;
  privacy mode (full roster of lights vs aggregate-only); invite via link / code
  / QR; host approval required.
- **E3 — Join flow.** See the bar + exactly what you'll share → Request to join →
  "Waiting for approval" → share-status consent.
- **E4 — Approvals queue** (Organizer / Gatekeeper) — pending requests,
  approve / deny.
- **E5 — Circle detail.** Aggregate readiness banner on top; roster of dots
  (glyph + label + role badge + display name/pseudonym); your own _shared / not
  shared_ toggle; event date / expiration countdown; role-based controls.
- **E6 — Manage & roles** (Organizer) — assign roles, edit the bar, set/change
  expiration, archive.
- **E7 — Check-in / "door" mode** (Organizer / Gatekeeper) — day-of, big and
  glanceable, low-light friendly, one-handed; tap or QR to check members in;
  running tally + live aggregate dot.
- **E8 — Positive-result transparency screen** — scope of who's notified, the
  always-on + anonymous nature, the small-circle anonymity caveat, CTA into care.
- **E9 — Leave / revoke** — stop sharing, leave, plain statement of what's removed
  (and that prior notices aren't retracted).

Guardrails: no member or host ever sees another member's conditions — only the
dot. **No live shaming** — if a dot flips to yellow/gray after joining, the
aggregate count updates but that person is nudged _privately_, never singled out.
Declining to share or showing gray is private and never blocks app use, only the
readiness count. Self-reported honesty marker on the aggregate banner. A circle is
a _declared cluster_, so the k-anonymity caveat is even stronger — copy must be
honest that in a small circle the source can be guessed.

### F. Sharing & live artifacts (fast-follow)

Principle: **the image is marketing; the link / QR is the proof.** Third-party
platforms (Grindr, Sniffies) re-host uploads, so any static image freezes — a
green card screenshotted in June still reads green in December. Every shareable
must therefore either visibly date itself or carry a live-verify QR. **Never let a
frozen green become a false all-clear.**

- **F1 — Share hub.** One tap from the card: _Copy link · Save image · Show QR ·
  Add to Wallet · Copy bio snippet_ — each labeled with where it stays live vs.
  freezes.
- **F2 — QR "share profile."** Full-screen, high-contrast QR encoding the live
  `sti.care/p/{token}` link — for in-person and the Circle door. Always resolves
  to current status.
- **F3 — Apple / Google Wallet pass.** Auto-updates over the air (APNs push for
  Apple; Wallet API patch for Google). Shows the current status light + "valid
  through" + self-reported marker, and carries the live QR. Backend pushes on
  every status change **and proactively on the freshness boundary** so a lapsed
  green never sits green on the pass face. The QR is the source of truth; the pass
  face is the convenient mirror.
- **F4 — Generated share-image** for upload-only photo slots (Grindr/Sniffies
  grid). Bakes test date + "valid through {date}" into the pixels + an embedded
  live QR, so a frozen/cropped copy dates itself and still offers a live path.
  Provide square + story sizes; must read when cropped.
- **F5 — Dynamic badge** (server-rendered SVG/PNG) for surfaces that hotlink (web
  bios, link-in-bio, forums) and as the **OG preview image** when the link is
  pasted in chat. Low cache TTL. _Honest caveats:_ chat platforms cache the OG
  preview, so the _preview_ can lag (the click-through is always live); live
  hotlinked images also phone home per view — a viewer-privacy vector to minimize.

---

## 4. Two flows to storyboard end-to-end

**Flow 1 — Positive result → anonymous partner alert.**
Report result (C2) → choose "positive, curable" → log treatment + expected clear
date → card flips to 🟡 "On the mend, clear by {date}" → app prompts "Want to let
recent partners know? It's anonymous." (C5) → user reviews the exact message,
sees "this will reach 4 people," confirms → partners receive a neutral nudge that
links to A3 → user is routed to C4 to finish their own care. Show the
k-anonymity guardrail copy for the "only 1 partner" edge case.

**Flow 2 — Receiving an exposure alert (the stranger's view).**
Anonymous link → A3 exposure landing → calm explainer + "find testing near you"
(map) + Heymistr + "claim your own passport." No login required to get help. If
they claim an account, they land in B3 onboarding.

---

## 5. Visual & brand spec (reuse, don't reinvent)

Match the existing `sti.care` system exactly, then add a **semantic status layer**
on top of the playful brand so the traffic light reads unambiguously.

- **Type:** `Bungee` for display/headlines, `Fredoka` for body/UI.
- **Surfaces:** paper `#fbf2dd` background with the radial dot grid; cards
  `#fffdf6`; ink `#181433`.
- **Borders & shadows:** `3px solid ink` borders; hard offset shadows
  (`5px 5px 0 ink`, small `3px 3px 0`). Sticker / cut-out feel.
- **Brand palette:** pink `#ff5d8f`, cyan `#37cfdb`, yellow `#ffce2e`,
  lime `#9ada3e`, purple `#9b6dff`, orange `#ff8a3d`.
- **Status (semantic) layer — design these as dedicated tokens, not raw brand
  colors, tuned for AA contrast and pairing with icon+shape+word:**
  green ≈ lime, amber ≈ yellow, **add a true alert red** (the brand has no clean
  red — pink reads wrong for "danger"; introduce one), gray neutral.
- **Card object:** treat it like a passport/boarding pass — bold stamp, the
  status light as the dominant element, a "self-reported" microcopy stamp, room
  reserved for a future "verified" foil badge.
- **Tone of copy:** frank, warm, sex-positive, judgment-free, plain words (the
  existing site literally says "dick, pussy, ass" — match that register, not
  clinical jargon). Everything localizable to en/es/pt/fr.

---

## 6. Hard requirements (don't ship without these)

- **Accessibility:** WCAG 2.2 AA; status legible in grayscale; color never the
  sole signal; full keyboard nav; respects reduced-motion; min 44px touch
  targets; screen-reader labels on the status light.
- **Privacy by construction:** logged-out = signal only; per-link revocable share
  tokens (default) with optional vanity handle; one-tap "delete everything";
  partner alerts truly anonymous + k-anonymity guardrail.
- **Mobile-first**, installable (PWA), works one-handed; the card is portrait and
  screenshot-friendly.
- **No verification theater:** never imply self-reported data is medically
  confirmed.

---

## 7. Open decisions to confirm before final UI

1. **Public identity model:** unguessable per-link tokens (recommended default)
   vs vanity `/@handle` vs both.
2. **Auth method:** email magic link, phone OTP, or passkey-first.
3. **The "positive, not-yet-in-treatment" public state** (see §2 callout) —
   confirm it collapses to gray "no current all-clear" rather than ever naming a
   condition publicly.
4. **Partner-notification channels:** in-app only, or also SMS/email to a contact
   the user enters? (Affects the anonymity model.)
5. **Lead share artifact:** Wallet pass first, or generated-image-with-QR first?
   (Wallet = most live; image = most familiar for the hookup-app grid.)
6. **Verify-link lifetime:** permanent token vs short-lived / rotating (rotating
   resists leaked screenshots but breaks anything posted earlier).
7. **Stale-copy stance:** how unmissable to make the date-stamp / expiry on
   generated images — subtle, or loud?

**Resolved for Circles (§3E):** host approves each member; three roles
(Organizer / Gatekeeper / Member); exposure notification is always-on; circles
have an optional expiration date; aggregate status = worst-of (green → yellow →
gray). _Open within Circles:_ default visibility (roster-of-lights vs
aggregate-only) and whether to keep a distinct red rather than collapsing it into
gray.

---

## 8. Deliverables for the designer

- Lo-fi IA / flow map covering Groups A–C and the two flows in §4.
- Hi-fi mobile screens for: A1, A2, A3, B1, B3, C1, C2, C5, C6.
- The passport **card** component in all four status states (+ a "verified"
  variant stub) and a grayscale proof of each.
- Status component spec (color + icon + shape + word) as reusable tokens.
- **Circles (§3E):** screens E1–E9, the per-member status dot (3 tones, each with
  glyph + label), the aggregate readiness banner (with counts), role badges.
- **Sharing (§3F):** screens F1–F5, the Wallet pass face in all status states
  (Apple + Google), the generated share-image template (date + "valid through" +
  QR), the full-screen QR, the dynamic badge / OG image.
- Copy deck (en first; structured for es/pt/fr).

---

## 9. Appendix — Build prompt: Circles & Events

Paste into the AI design agent.

> **Build "Circles & Events" for the sti.care STI Passport app.**
>
> **Context.** Extends a sex-positive sexual-health app where members self-report
> STI results and carry a privacy-first "passport" showing only a traffic-light
> status — never the underlying conditions. Circles let people form a private
> group (recurring crew, polycule) or a dated **Event** (a party), self-register,
> and share their status _with that group_ so everyone can see the room is current
> — without anyone's details exposed. Reuse the existing design system (calm,
> modern, trustworthy; warm off-white surfaces, soft rounded cards, one teal
> primary, muted semantic status colors, clean humanist sans). **Keep "orgy" out
> of the UI** — neutral naming for discretion. Mobile-first.
>
> **Per-member status dot** — three tones, each ALWAYS with a glyph + text label
> (never color alone; must read in grayscale and for color-blind users):
> 🟢 green + ✓ "Ready" · 🟡 yellow + clock "In treatment" · ⚪ gray + dash "No
> current status" (not shared, expired, or out of date).
>
> **Aggregate status = the WORST (lowest) status present** among approved members.
> Severity best→worst: green → yellow → gray. 20 green + 1 yellow = **yellow**;
> any gray present = **gray**. Show as a top banner: color + icon + word + counts
> ("Almost ready · 20 ready · 1 in treatment"). Members who joined but haven't
> shared count as gray. Mirror the aggregate dot on the list and in check-in mode.
>
> **Roles (3 tiers), with a role badge per row.** Organizer/Admin (owns; edits the
> bar, sets/changes the optional expiration, assigns roles, approves members,
> archives/deletes) · Gatekeeper (member with gating rights: approve/deny join
> requests + run check-in; can't edit core settings or delete) · Member/Attendee
> (joins after approval, shares status, sees roster + aggregate, leaves anytime).
>
> **Joining = host-approved.** Open invite link / short code / QR → see the
> group's **bar** in plain words ("tested within the last 30 days") and exactly
> what you'll share (status light only, never details) → **Request to join** →
> "Waiting for approval" → an Organizer/Gatekeeper approves → **consent step:
> "Share my status with this circle."** Include an **Approvals queue** screen.
>
> **Optional expiration date.** A circle/event can expire; show a countdown; on
> expiry auto-archive (roster + sharing stop). Dated events put the date front and
> center.
>
> **Exposure notification — always on.** When a member logs a positive result,
> everyone in their circles is automatically + anonymously notified via the app's
> exposure-alert landing. Not a per-circle opt-in, BUT show the member a
> **transparency screen** when it triggers: who's in scope, that it's always-on
> and anonymous, an honest small-circle caveat ("people may reasonably guess the
> source"), then route to care. Semantics: the notify set is **live during the
> window** (positive → treatment logged clear) — people who join, or new links
> created, in between get caught up on the **next** send; **removing** someone does
> **not** retract a sent notice.
>
> **Screens:** (1) Circles & Events list; (2) Create circle/event; (3) Join flow;
> (4) Approvals queue; (5) Circle detail (aggregate banner + roster + your share
> toggle + expiration countdown + role controls); (6) Manage & roles;
> (7) Check-in / "door" mode (glanceable, low-light, QR/tap, live tally +
> aggregate dot); (8) Positive-result transparency screen; (9) Leave / revoke.
>
> **Guardrails (non-negotiable).** No member or host ever sees another's
> conditions — only the dot. No live shaming (aggregate updates, but a flipped dot
> is nudged privately, never singled out). Declining / gray is private and never
> blocks app use, only the readiness count. Everything is self-reported (not
> verified) — show the honesty marker on the banner, leave room for a future
> clinic-verified tier. Discretion everywhere; WCAG 2.2 AA; status = color + glyph
>
> - word.
>
> **Deliverables:** hi-fi mobile screens for 1–9, the per-member status dot (3
> tones with glyph + label), the aggregate banner (with counts), role badges,
> empty states.

---

## 10. Appendix — Build prompt: Sharing & live artifacts (QR + Wallet)

Paste into the AI design agent.

> **Build "Share my passport" + live artifacts for the sti.care STI Passport
> app.**
>
> **Context.** The status passport card already exists; this adds the ways to show
> it elsewhere and keep them honest. Reuse the existing design system. **Core
> principle: third-party platforms (Grindr, Sniffies) re-host uploads, so a static
> image freezes — the image is marketing, the link/QR is the proof. Every
> shareable must visibly date itself or carry a live-verify QR. Never let a frozen
> green become a false all-clear.** Teach the norm: _scan to verify live; don't
> trust the picture._
>
> **Build:**
>
> 1. **Share hub** (sheet from the card): _Copy link · Save image · Show QR · Add
>    to Wallet · Copy bio snippet_ — each labeled live-vs-frozen.
> 2. **Full-screen QR "share profile"** encoding the live `sti.care/p/{token}`;
>    bright, high-contrast, one-handed; doubles as the Circle door code.
> 3. **Apple + Google Wallet pass face:** status light + glyph + word + "valid
>    through {date}" + self-reported marker + live QR. Design the updated states
>    (green / yellow / gray). It auto-updates over the air.
> 4. **Generated share-image** (square + story sizes) for upload to hookup-app
>    grids: status light + date tested + "valid through {date}" baked into the
>    pixels + embedded live QR + sti.care mark. Must read when cropped; a stale
>    copy dates itself.
> 5. **Dynamic badge** (SVG) + **OG preview image** for hotlink / chat surfaces.
>
> **Guardrails:** never reveal conditions; self-reported marker on every artifact;
> the QR uses a revocable token; WCAG AA, status = color + glyph + word;
> discretion (neutral, nothing that outs context).
>
> **Implementation notes (so it truly stays up to date):** Apple = `.pkpass` +
> PassKit web service + APNs push that tells the device to re-pull the latest
> pass; Google = Wallet API generic pass, PATCH the object to propagate to saved
> devices. Push on **every status change AND on the freshness-window boundary**
> (scheduled job), so the pass face never sits stale. The QR always points to the
> live link as the source of truth.
>
> **Deliverables:** screens/artifacts F1–F5, the Wallet pass in all status states,
> the generated-image template.
