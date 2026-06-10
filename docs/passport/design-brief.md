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

---

## 8. Deliverables for the designer

- Lo-fi IA / flow map covering Groups A–C and the two flows in §4.
- Hi-fi mobile screens for: A1, A2, A3, B1, B3, C1, C2, C5, C6.
- The passport **card** component in all four status states (+ a "verified"
  variant stub) and a grayscale proof of each.
- Status component spec (color + icon + shape + word) as reusable tokens.
- Copy deck (en first; structured for es/pt/fr).
