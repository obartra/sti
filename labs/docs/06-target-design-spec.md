# sti.care — Target Design Spec (build toward this)

*For the design agent. This is the **target state**, written positively so you can build
toward it — not a list of removals. It is self-contained: you should not need the audit or the
rubric to act on it. Where the current build conflicts, this document wins. Fork the status +
identity layer locally; treat the design system as type / spacing / surface only.*

*Status: most "open questions" from the audit are decided below. Three are genuinely still
open and marked **[OPEN]** — make your best proposal and flag, don't block on them.*

---

## 0. What this product is (so every screen serves it)

A shareable "passport" that makes testing and disclosure ordinary and helps people make
science-based decisions. It is **harm reduction, never a gate.** Every screen must read as
"come in, here's how we look out for each other, here's free care nearby," never "you don't
belong until you're compliant." When a visual could sort people, blunt it.

The whole design rests on one idea: **the only two things a viewer ever sees are a blunt badge
(blue/gray) and, when authorized, a few flat protection facts.** Everything else — diagnoses,
dates, who's linked to whom, group membership — lives on the user's device and is never a
viewer surface.

---

## 1. The badge — two states, three routes to blue

**Two visible states only: BLUE ("up to date") and GRAY.** No green/amber/red, no tiers, no
rank above blue.

**Blue is earned when all three are true** (computed on-device):
1. Tested within the last **90 days**, where "tested" = the **standard core panel (HIV, syphilis,
   gonorrhea, chlamydia)** with every **exposed site** covered (per-site "tested clear OR not
   exposed," computed on-device, never displayed — showing tested sites would leak behavior). A
   urine-only / core-incomplete test does not earn blue.
2. **Clear** — no current active non-HIV STI. (The only acceptable positive is prior-treated
   syphilis serology; that's an input detail, not a viewer surface.)
3. **Actively protected against HIV** by at least one of three routes: **on PrEP**,
   **undetectable**, or a **public commitment to always using condoms.**

**Never-tested is always GRAY.** Blue is earned from a real recent result, never assumed.

**Gray is one wide, flat bucket.** Overdue, never-tested, paused, mid-treatment, in-care-but-
not-yet-undetectable, and "tested but no qualifying protection" all render as the *same* gray.
No sub-labels, no "expired," no "needs a fresh test," no color or glyph that distinguishes
*why*. The blunt-ness is the privacy.

**Visual:**
- Blue: a calm filled fill + a **neutral mark** (a filled dot or "in-window" ring — **not a
  checkmark**, which whispers "pass") + the label **"Tested & on HIV prevention"** (names both halves; avoids "safe/protected").
- Gray: a neutral dash + **"No status shared right now."** Never reads as a failure.
- Keep two distinct shapes (not color alone) for accessibility.

**The blue card carries protection labels (this is new vs. the current build):**
- **"On HIV prevention"** — the single shared umbrella for PrEP *and* undetectable. It is
  **identical for both and must never be splittable** into which one. This is a hard rule: a
  viewer can never tell PrEP from undetectable. (Undetectable is never a viewer-visible word
  anywhere — it exists only as the owner's private input.)
- **Condom preference (3-state)** — "No condoms," "Condoms optional," "Condoms always" —
  an optional self-declared boundary, **decoupled from how blue/gray is computed.** All three are
  displayable flat attributes. Only **"condoms always," shown publicly,** qualifies as the
  HIV-protection route for blue; the other two never affect the badge. Keep all three displayable
  so "condoms always" isn't a lone tell (a bare binary would make it conspicuous).
- The umbrella and the condom preference are **independent**: any combination may show. Showing/
  hiding one must never force or suppress the other.

**No verdict language.** Never "all clear," "clear," "safe," "green light," "good to go." The
card states a fact, the human concludes. Honesty lives in one plain, low-reading-level sentence of
body copy on the profile (not a chip, not a stamp): *"[handle] says they've tested recently and
take steps to prevent HIV. They're telling you themselves — it's not a lab result."* Every
rendered card (blue or gray) carries an identical "What does this mean?" tap to the stranger
explainer (see design §12c).

---

## 2. No verification mark, ever

There is **no** "verified," "unverified," or "self-reported" stamp, chip, badge, or field
anywhere a viewer can see. Any such mark implies a missing tier and becomes its own status
signal. Honesty is the plain sentence above. Reserve **no** layout space for a future
"verified" chip — a later lab-connect feature changes the owner's input only and must never
alter what a viewer sees.

---

## 3. Pause — the invisible "not right now"

Add a real pause concept (the current build has none; it wrongly shows treatment as a visible
amber state).

- **Manual pause:** "hide my status" anytime.
- **Auto-pause:** computed on-device from a logged positive's clearance window.
- Both render as **ordinary gray** — no date, no "paused" label, no timestamp, indistinguish-
  able from never-tested or didn't-share.
- The **owner** may privately see their computed un-pause date; a **viewer** never does.
- Extend a pause: yes. Shorten below the guideline: no.

Remove every "Clear by [date]" and treatment timestamp from all viewer surfaces.

---

## 4. Flat protection attributes (beyond the badge labels)

Optional, self-declared, never ranked or summed: **"uses condoms," "on doxy-PEP"** (and the
"On HIV prevention" umbrella from §1). Shown as plain facts.

- **Shown on gray too** — they're most useful exactly when the testing badge is absent.
- Gated by **authorization** (who's asking), **never by badge color.**
- HIV-protection facts are **HIV-only** — never framed as "fully safe"; other-STI recency is a
  separate axis.

---

## 5. Identity — opaque aliases, no canonical handle

Replace the single permanent public handle entirely.

- **No user-facing "main handle."** The only ids are **aliases**: an opaque id in the URL +
  a display **handle**/avatar held *inside* the encrypted payload.
- **No real names, anywhere.** Display identity is a **handle/alias + avatar — never a first/
  last/legal name.** There is no name field in the system (not stored, not optional, not hidden).
  Any current screen showing a person name (e.g. "Sam Rivera," "Robin Vale") must become a handle
  (e.g. "@sam_r") + avatar, and any name input removed.
- Aliases are **multiple, creatable, revocable.** Nothing is permanent or canonical.
- A **vanity/custom handle** is an explicit, **public-only opt-in**, taught at the choice
  point in one honest line: *"This makes you findable and isn't unlinkable from anywhere else
  you use this name — and it points at your status."* Never the default.
- The **account key** (passkey/passphrase) is the local anchor — **never shown, never in a
  URL.** Decouple it from any display identity.
- **No searchable handle directory. No "anyone can find you."** Discovery is member-initiated
  and link/scan-scoped only (see §8). Kill global search and the "always findable" framing.

---

## 6. Resolution — two states per alias, existence hidden by default

How a profile resolves depends on which **key** the viewer holds (public vs private is a
key-distribution choice, not a server flag).

- **Private alias, unauthorized/anonymous viewer →** uniform **gray-nothing, identical to a
  nonexistent alias.** No name, no avatar, no "this is private," no "request access" button on the
  cold/anonymous/guessed view. Existence is hidden. (This kills the current "locked card" third
  state.) A viewer who *holds the shared link* but isn't authorized may **knock** (see §9a) — the
  link is what reveals existence to them; the cold view stays button-free.
- **Private alias, authorized viewer →** full view (badge + labels + handle).
- **Public alias →** anyone with the link sees badge + labels; existence is waived by the
  owner's choice.

So there are exactly **two observable states per alias, never a third** ("gray-with-labels vs
gray-without-labels" only happens if you try to serve both intents on one alias — don't; they
are separate aliases). Responses must be **uniform in shape and timing** so existence doesn't
leak via size or latency (spec this for engineering even if the prototype renders
synchronously).

**Request-access**, if offered at all, appears **only via a link the owner already shared** —
never on the anonymous view (it would confirm existence).

**Public is opt-in and default-OFF.** Flip the current default from "Everyone" to private.

**Public profiles are watchable over time — design for it:**
- Coarsen all dates on the shared view (see §9 [OPEN]); remove day-counters and the freshness
  meter from viewer surfaces.
- Add **hysteresis** on blue↔gray transitions (the flip lags the underlying change on a
  fuzzy/batched schedule so it can't be correlated to a health event).
- Add a plain **"this is watchable over time"** warning on the public toggle.
- (Engineering: rate-limit, consider login-gating public reads.)

---

## 7. Sharing — time-bound, revocable, per-token

- Grants can be **point-in-time, durational, or until-revoked.** **Default new links to a
  routine expiry (e.g. 30 days)** rather than until-revoked.
- "Revoke" = **no future reads** (not "unsee"); say so honestly.
- **Visibility and revocation are per-token / per-capability — there is no global "can this
  person see me" state.** Leaving one group or revoking one link never affects what you share
  through another alias or token.
- **Status and access are orthogonal:** pausing changes what you show; revoking changes who
  can see you via that path; neither moves the other, nothing auto-rejoins.
- **Access changes are visible to the affected person** (they can tell their own access ended),
  but to **other group members, "left" and "was removed" look identical** — no public removal
  mark, no reason ever stated. The app never auto-revokes from a health event.

---

## 8. Linking — silent, date-defaulted, alias-based

- A link records "these two aliases met on [date]," used **on-device** for exposure windows.
- **Encounter date defaults to today and is editable / back-datable** at log time. It never
  leaves the device and is never shown to the contact.
- **Linking is silent.** The contact is **never told** they were logged — remove
  "@someone logged a linkup with you" and any "add-back" suggestion. (The owner's on-device
  exposure math is the only consumer.)
- **Scan-to-autolink** (if in scope): a scan **proposes** a link both people confirm (never
  silently binds) and exchanges an **alias, not a handle.**

---

## 9. Partner notification — draft, lock, then invisible

**Flow: draft → lock → delivery (mechanics invisible after lock).** The user controls **the
facts** (who they linked with) during an editable draft window; after that the rest is not the
user's concern — it's about the recipients' health.

- **Draft window (~30 min, one config constant):** the user edits the recipient list freely —
  add, correct, **remove** — and may **delete the whole report** at any time. Each save replaces
  the prior draft (keep only the latest; last-write-wins). Removal is **frictionless**; delete-
  the-whole-report is the real safety valve. *(This deliberately replaces the audit's "no cancel
  after commit" — making removal hard backfires into telling no one.)* Replace the indefinite
  "Pause for now" with simple draft editing.
- **Lock (at window's end):** the batch becomes historical and immutable. Editing the result,
  removing a contact, or un-linking later does **not** touch it.
- **Post-lock — invisible by design:** the app tells the user **nothing** about notification
  timing, delivery, or recipients — no "sending in X," no delivery status, no counts, ever.
  Remove any such readout. The locked batch enters a server-side send cycle (cross-user batching
  for anonymity) that is never surfaced.

**Message content is anonymous and contentless:** *"A recent contact suggests getting tested.
It's quick and often free."*
- **Never** who, **never** what (no "tested positive for an STI"), **never** when, **never** a
  count (no "2 partners").
- Never labeled 1:1-vs-circle. **Merge circle exposure into the same contentless pipeline** —
  no separate "transparency" surface, and **no per-circle "N people notified" counts** on the
  owner side.
- **Server-timed batching** for anonymity rather than a hard per-user K threshold that blocks
  low-partner users. (Keep a gentle "one recipient can't be anonymous" note, but don't
  hard-block.)
- **Reachability:** identity-free **push** (primary) + a **pull "go get tested" page**
  (fallback for off-app contacts). Keep the PEP info as an informational ramp to care, not a
  real-time "you were exposed at 9pm" alarm.

---

## 9a. Knock — stranger access to a private profile (no third mode)

A private alias can be **advertised** (its link on a dating profile/bio) while keeping status
gated. A link-holder who isn't authorized can **knock** (request access); the owner decides. This
is **not** a new sharing mode — it's what *private* does for a link-holder-without-key.

- **Existence-safe by uniform response (load-bearing):** the knock endpoint returns the **same**
  "if this passport exists, your request was sent" for real, fake, and guessed ids. Presence-
  invariant, so the affordance leaks no existence (invariant 6 intact). The cold/guessed view
  still shows no knock button at all; the knock UI appears only to a link-holder.
- **Requester sees only that uniform confirmation** — then status silently resolves to a badge
  (granted) or stays gray-nothing (not granted / nonexistent — indistinguishable). **No pending/
  granted/denied signal ever.** Their confirmation is the conversation, not an app readout.
- **Always review, never auto-grant.** Owner alerting = a **quiet persistent indicator** on the
  alias (owner-pull, no per-knock push/buzz).
- **Auto-expiry ~4 days + "clear all"** bulk-dismiss; knocks **contentless + rate-limited** per
  requester/id.
- **Forwarded-link caveat (accepted):** a private link is forwardable, so a leaked link can
  generate knocks — but reviewed + contentless means it only ever yields ignorable knocks, never
  status.

---

## 10. Circles — mutual care, never a club

- A convenience layer over pairwise links. Permanent or event-based. **Not** a live feed,
  **not** a "clean club."
- **Cut "Door mode" / "the bar" / any bouncer or check-in entirely.** A room "Ready / Waiting"
  verdict and a tested-within-N-days entry threshold are exclusion gates — the most
  off-mission surface in the build. If any norm is shown, it's plain non-enforcing text
  ("people here usually test regularly"), no check-in, no readiness tally.
- **No counts, ever.** Remove "7 ready · 1 in treatment · 2 not shared" and all per-status
  tallies — a single "1 in treatment" outs someone by elimination. No leaderboards.
- **No "worst-of" room rollup.** After the blue/gray collapse, prefer a flat "everyone here
  shares a status" presence model that doesn't aggregate health state.
- **Minimum group size ~5** for any group-level status surface (keep the existing guard).
- **Per-group handle visibility, private by default**, plus a **universal "there may be
  additional private members" notice on every roster/aggregate** (always, even when there are
  none — so privacy doesn't leak by completeness).
- **Discovery is member-initiated, link/QR-scoped** (keep). No open circle search.
- **Anti-spam:** pull + **sticky declines** + rate-limiting. **No max-group cap.**
- Joining, leaving, and skipping a share all look ordinary.

---

## 11. Testing reminders — supportive, private, frequency-neutral

- **Remove the testing streak / heatmap / "day streak" from every viewer surface.** Frequency
  is never a viewer-visible flex. If a "you test regularly" affirmation is kept, it's
  owner-only, non-competitive, non-streak.
- Remove "test monthly = extra-fresh card" and any "more testing = better" reward.
- Keep the local reminder ("next test in N days," ping-before, disableable). Make it
  **pause-aware** (suppress during treatment/auto-pause) and never shaming.

---

## 12. Language

- **Ban from viewer surfaces:** clean, dirty, clear, "all clear," healthy (as status), safe,
  disease-free, "green light," verified, unverified, "negative" as an identity, "expired,"
  "needs a fresh test," "waiting on shares," "on the mend."
- **Use behavioral framing:** "Tested & on HIV prevention" (blue), "On HIV prevention," "No status shared right now" (gray).
- "Negative" is fine as a clinical **result input**; "healthy" is fine inside **clinical
  education** copy ("treatment lets you live a long, healthy life") — just never as a
  status-identity word on a card.

---

## 13a. Wallet passes, QR & shareable card

All shareable artifacts (Apple Wallet pass, Google Wallet pass, standalone shareable card image)
inherit every badge rule: two-state, **handle + avatar (never a name)**, sti.care logo, boolean
precision, no dates/streak/stamp/count.

- **Format is a user choice, gated by privacy mode.**
  - **QR format — any alias (public or private).** Pass face shows **no status** — just QR +
    handle + avatar + logo. It's a link carrier; downstream resolution gates everything (public →
    viewer sees badge; private + authorized → sees it; private + unauthorized → uniform
    gray-nothing). This is how a private user safely carries a pass.
  - **Live-status format — public aliases only.** Pass face shows blue/gray and auto-updates;
    turning it on forces/confirms public.
- **Fail closed to gray.** Blue is valid only on a fresh confirmed read (freshness window 24h, one
  config constant — a liveness guard, not the 90-day clinical window); staleness or an
  unreachable server → **gray, never stale-blue.** Staleness is **not** a distinct visible state
  and there is **no** owner-facing "couldn't refresh" message — stale just renders as ordinary
  gray.
- **Accessibility:** render the alias URL as text beside the QR (public/QR-carrier passes only);
  QR/URL encode an **alias**, never a cross-linking account id.

---

## 14. Architecture the UX must imply (not contradict)

The UI must never imply a central directory or social graph. On-device: the contact graph,
group membership, aliases, badge/clearance math. Server: only ciphertext + opaque routing
tokens. No account needed to view a public alias. No analytics/ad SDKs near health surfaces.
"Delete everything" stays. So: no global handle search, no "stored against your handle" copy
that implies a server-side who-is-who, no "always findable."

---

## Decided (you can build on these)

- **Blue label (displayed):** "Tested & on HIV prevention" (names both halves; avoids "safe/protected/cleared"). "Up to date" is an internal concept word only.
- **Blue glyph:** neutral mark (dot/ring), not a checkmark.
- **Streak:** removed from all viewer surfaces (not recolored).
- **Door mode / "the bar":** cut entirely.
- **Request-access:** only via an owner-shared link; never on the anonymous view.
- **Partner-notify K:** server-timed batching, not a hard per-user K; removal is frictionless; draft→lock then post-lock invisible.
- **Linking:** fully silent; no add-back suggestion.
- **Design-system conflict:** local fork of status + identity; DS for type/spacing/surface.
- **Public default:** OFF (private by default).

## Still open — propose, don't block **[OPEN]**

1. **Temporal precision on the shared view:** leaning boolean ("in window / not shared") to
   anonymous viewers, "as of [month]" on the owner-chosen public view, exact dates owner-only.
   Confirm.
2. **Notification draft-window length (~30 min) + send-cycle cadence** — propose a default.
3. **Label-display residual:** "condoms always" shown *without* the umbrella weakly implies
   HIV-negative-not-on-PrEP. Accepted as far less harmful than any positive-status leak — flag
   if any layout sharpens it, but don't try to engineer it away.

---

*Deliverables I'd want from you next: (a) the blue and gray cards (with "On HIV prevention" +
condom-preference + umbrella label states, and the combinations), and (b) the
uniform private/nonexistent resolution state — so the two-state model and the new protection
labels are concrete before any build. Propose; implement nothing until the badge states are
signed off.*
