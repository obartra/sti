# sti.care — Decisions Log

_Reviewed for consistency: June 15, 2026. Reflects the feature-complete build._

*Scannable record of locked decisions and rejected options. Mechanics live in the Design doc; rationale in the Philosophy doc. Open items at the bottom.*

---

## Badge

- **LOCKED — Two visible states, blue ("up to date") / gray only.** No ranking, no tiers, no "platinum."
- **LOCKED — Blue requires ALL of:** (1) tested within **90 days**, where "tested" = the **standard core panel (HIV, syphilis, gonorrhea, chlamydia)** — universally offered, so not an access tax — **with every *exposed* site covered** (per-site "tested clear OR not exposed"; see site rule below); (2) **clear** — no current active non-HIV STI, the *only* acceptable positive being **syphilis serology from prior treated history**, not current infection; (3) **active HIV protection via at least one of three routes** — on PrEP, undetectable, **or** a public commitment to condoms-always.
- **LOCKED — "Tested" has a defined scope (closes the "I don't test oral GC" / "my center skips syphilis" gap).** Infection floor = the standard core panel (every center offers it, so requiring it privileges no one). Site coverage = per-site **"tested clear OR not exposed there,"** computed **on-device**: no oral → pharyngeal satisfied by *not exposed* (no irrelevant swab forced); does oral → satisfied by *swabbed clear*. The per-site reasoning is **NEVER displayed** — surfacing tested sites leaks behavior (pharyngeal⇒oral, rectal⇒receptive anal). The site logic produces the badge, never a viewer-facing fact. Residual (window period, 30+ pathogens beyond the core) is handled by the explainer ("good sign not a guarantee; fair to ask what and when"), not by itemizing on the card.
- **LOCKED — Never-tested → always gray.** Blue is earned from a real recent result, never inferred from low risk or "no history" (even a virgin can have HIV).
- **LOCKED — Gray = everything else** (overdue, never-tested, paused, current active infection, or no qualifying protection route). Wide mixed bucket.
- **LOCKED — The three routes surface via labels** (see Flat attributes): PrEP and undetectable share one **identical** umbrella label; the condom route is the **"condoms always"** value of a 3-state condom preference, shown publicly.
- **LOCKED — Efficacy differences (condoms < PrEP/U=U) are handled by EDUCATION, not ranking** — a committed sex-ed-access responsibility, not a disclaimer.
- **LOCKED — Healthism named openly:** a deliberate mid-epidemic choice to reward active HIV prevention, which refuses to become a serostatus gate (the positive state is reachable by the cheap, near-universal condom route, backed by access ramps).
- **LOCKED — The badge reflects CURRENT STATE, not DIAGNOSIS HISTORY (the general rule for "what about condition X").** Three axes, never conflated:
  - **Chronic / lifelong manageable diagnosis (HSV, HPV) → EDUCATION, never the badge.** Never grays anyone, never a label, never a profile/attribute element. A lifelong gray for a common manageable condition is the permanent-sentence trap the project refuses. Their seriousness is honored by making prevention reachable (vaccination, screening) for everyone, tied to no one's status.
  - **Transient active higher-transmission episode (e.g. an HSV outbreak — visible sores/prodrome) → PAUSE.** This is exactly what the existing pause mechanism is for: the person pauses during the outbreak, the badge goes gray identically to every other gray (no "outbreak"/"herpes" tell, no reason shown), and un-pauses when it clears. The transient high-risk window grays; the chronic condition doesn't. Pause is voluntary (self-reported, like everything); education teaches that pausing during an outbreak is the considerate move and why.
  - **Testing recency → the 90-day clock only.** An outbreak is a symptom, not a test result; it is NOT folded into the testing window. Don't conflate "when did you last get screened" with "is there a transient reason to hold my status."
- **LOCKED — HPV specifically:** out of the badge and attributes entirely; education/resources only (vaccination + screening ramps, universal, status-free). HPV causes *warts* (low acute-decision urgency) and a slow cancer risk managed by vaccine/screening — neither is a "this week" disclosure moment. (HPV does not cause sores; that's HSV — don't conflate.)
- **LOCKED — Syphilis serofast vs reinfection:** prior-treated syphilis serology (serofast) does NOT break "clear"; a genuine reinfection (rising titer) does. Captured as an input distinction at report time.
- **REJECTED — Green** ("safe/go"). **Yellow/red** (warning states decode to "has something now"). **Platinum / any rank above blue** (implies "best," re-creates sorting, and a visible "protected set" tier leaks). **A "recently-tested ⇒ low viral load" route** (scientifically false — acute infection is the *highest* viral-load window).
- **REJECTED — Gating blue on PrEP *adherence* ("consistent PrEP" vs "sometimes PrEP").** Tempting by analogy to "condoms always," but wrong: (a) self-reported adherence is among the most biased measures in HIV research — gating the trust signal on an unverifiable, aspirational number makes blue mean *less*; (b) it collects a sensitive behavioral-adherence data point we can't verify and don't need; (c) "condoms always" is a *boundary/intention* a user can honestly declare, while "doses missed" is a *clinical-adherence claim* users can't correctly translate into protection (the math differs by exposure type); (d) it re-creates the within-umbrella *tier* the whole model rejects, and worse, splits the "On HIV prevention" umbrella that MUST stay uniform (undetectable sails through, PrEP-with-gaps fails — breaking the camouflage invariant). **"On PrEP" qualifies, full stop**, exactly as "undetectable" does — both are the person's honest declaration; efficacy nuance is **education**. Adherence is used to *help* the user (PEP-relevance, optional on-device support), never to *rank* them.
- **OPEN — for outside review:** (a) detectable-poz-in-care can't reach blue until suppressed — and a near-universal positive state may make non-qualifiers *more* conspicuous; (b) PrEP-choice-normativity — someone who declines PrEP for autonomy reasons must use the condom route or be gray. **OPEN — label-display residual:** showing "condoms always" without the umbrella weakly implies HIV-negative-not-on-PrEP — a negative-status inference, accepted as far less harmful than any positive leak; confirm.

## Pause

- **LOCKED — Manual pause anytime; auto-pause during treatment/clearance windows, computed on-device** from the user's own recorded result + date.
- **LOCKED — Extend a pause yes; shorten below the minimum guideline no.**
- **LOCKED — Auto-pause, manual pause, never-tested, and didn't-share all render identically.** No dated or labeled "paused" state.
- **LOCKED — Pause visibility is the user's choice** (public, or revealed only via point-in-time access).

## Flat attributes & protection labels

- **LOCKED — PrEP and undetectable surface ONLY under a single shared umbrella label, "On HIV prevention," identical for both and never distinguishable** (HARD INVARIANT). This camouflages undetectable people among the PrEP majority. "Undetectable" is **never** a viewer-visible attribute (it is HIV-positive disclosure); method is never shown.
- **LOCKED — Condom preference is a 3-state, optional, self-declared attribute** — displayed as **"No condoms," "Condoms optional," "Condoms always"** (internal state keys `raw` / `either` / `condoms_always`) — **decoupled from how blue/gray is computed.** All three are displayable flat attributes; **only "Condoms always," shown publicly,** qualifies as the HIV-protection route for blue. Keeping all three displayable is required so "Condoms always" isn't a lone tell. (The earlier "either works" label was renamed to "Condoms optional" for clarity in Pass 5b.)
- **LOCKED — Umbrella and condom preference are independent and independently displayable**; neither's presence/absence implies the other, so the umbrella's absence stays uninformative.
- **LOCKED — "uses condoms" and "on doxy-PEP" remain optional self-declared flat attributes;** never ranked or summed into a verdict.
- **LOCKED — PrEP and undetectable are equivalent HIV-protection paths, but HIV-only** — never "fully safe"; other-STI recency is a separate axis.
- **LOCKED — Attributes/labels show on gray too** (most useful then) and are gated by **authorization**, never by badge color.

## Verification

- **LOCKED (MVP) — Entirely self-reported; NO "verified"/"unverified"/"self-reported" mark.** Any mark implies a missing tier and is itself a status signal. Honesty is plain descriptive copy.
- **REJECTED — Viewer-visible verification** (encodes privilege via who has EHR-connected care; a sorting signal).
- **DEFERRED (Post-MVP) — Verification as INPUT-ONLY:** may improve the owner's own app (auto-pause accuracy, less data entry); must never change the viewer-facing output in any version.

## Circles (groups)

- **LOCKED — A convenience layer over pairwise links; not a live status feed, not a "clean club."** Permanent or event-based.
- **LOCKED — Minimum group size (~5) for group-level status comms; no counts; no leaderboards; joining/leaving/skipping looks ordinary.**
- **LOCKED — Per-group handle visibility (private by default); universal "there may be additional private members" notice** (so private membership is uninformative).
- **LOCKED — Membership disclosure is per-person; revealing a group's existence never reveals its members.**
- **LOCKED — The individual controls their own status disclosure in a group; the group never overrides it.** No group-level switch makes members' statuses visible (it would expose a member beyond their own choice). Each member's in-group visibility is the member's own setting; any group display preference operates only within what each member already shares (hides, never reveals). The min-group-5 rule is a separate hide-only floor. (Build: remove the group "what members see" status toggle, it's drift.)
- **LOCKED — Discovery = member-initiated, link-scoped** (only someone you've already paired with can reveal a group). No open search, no stranger discovery, no contact intersection.
- **LOCKED — Anti-spam via consensual pull + sticky declines + outbound rate-limiting.** **REJECTED — max-group caps** (punish legitimate organizers more than abusers).
- **LOCKED — No testing "bar" / cadence requirement for groups.** A 14/30/90-day "tested within X" group requirement implies a *verifiable* testing standard the system cannot provide (everything is self-reported; blue already encodes testing recency). It's false rigor. Groups are simply **mutually-linked shared spaces**, not a gate that enforces a cadence. (Removed from the build in Pass 5 fixes.)
- **OPEN — Is the group construct a care tool or a serosorting gate?** → for outside review.

## Identity & sharing (aliases)

- **LOCKED — No user-facing "main handle."** The only ids are **aliases**. The local account key (passkey/passphrase) is the anchor — never shown, never in a URL.
- **LOCKED — No real names, anywhere.** Display identity = handle/alias + avatar, never a first/last/legal name. No name field exists in the system (not stored, not optional, not hidden) — a name is a collection surface the product has no use for.
- **LOCKED — Public vs private is a key-distribution choice, not server data.** Private = key held by authorized contacts; public = key in the URL fragment. Server stores only `opaque_id → ciphertext` either way and never sees a handle.
- **LOCKED — Opaque-id aliases are the default; a vanity/custom handle is an explicit public opt-in**, flagged at the choice point as findable and not unlinkable.

## Resolution & privacy

- **LOCKED — Two modes, two states each, no leaky third.** Private alias → authorized see full, everyone else sees uniform gray-nothing (= nonexistent). Public alias → everyone sees badge + attributes; existence waived.
- **LOCKED — Uniform responses in shape AND timing** (existence-hiding can't leak via size/latency).
- **LOCKED — Public profiles are scrapeable over time and can't be fully protected;** mitigations: opt-in/default-off/time-boxed, login-gated if possible, coarse temporal granularity, transition hysteresis, rate-limiting, and an honest in-app warning.
- **LOCKED — Knock (stranger access to a PRIVATE profile, no third mode).** A private alias can be advertised (link on a dating profile) while keeping status gated; a link-holder can **knock** (request access) and the owner decides. NOT a new mode — it's what private does for a link-holder-without-key.
  - **Existence-safe by uniform response:** the knock endpoint returns the SAME "if this passport exists, your request was sent" for real / fake / guessed ids — presence-invariant, so the affordance leaks no existence (invariant 6 intact). Password-reset pattern.
  - **Requester sees only that uniform confirmation;** then status silently resolves (granted) or stays gray-nothing (not granted / nonexistent — indistinguishable). NO pending/granted/denied signal ever.
  - **Always review, never auto-grant.** Owner alerting = a **quiet persistent indicator** on the alias (owner-pull, no per-knock push/buzz).
  - **Auto-expiry ~4 days + "clear all"** bulk-dismiss; knocks **contentless + rate-limited** per requester/id.
  - **Forwarded-link caveat (accepted):** a private link is forwardable, so a leaked link can generate knocks — but reviewed + contentless means it only ever yields ignorable knocks, never status.
- **LOCKED — Public-profile shareable = resolving link/QR, not a baked-in status image.** Tap resolves live; no status snapshot to go stale. A status image may be offered but is framed "scan for current," never the default. This lets a PRIVATE user advertise on a public profile without going public.

## Time-bound & revocable sharing

- **LOCKED — Grants can be point-in-time, durational, or until-revoked, for individuals or groups.** "Revoke" = no future reads, not "unsee."
- **LOCKED — Visibility and revocation are per-token / per-capability; there is NO global access state.** What a viewer sees depends on which token/alias they hold. If you're linked to someone through two paths (a group token and a separate alias) and you leave the group, they still see whatever the other token grants — leaving one path doesn't touch the others. Removal from one path just makes that path go dark; it says nothing about the rest.
- **LOCKED — Status and access are orthogonal** (pause changes what you show; revoke changes who sees via that path; nothing auto-rejoins).
- **LOCKED — Access changes are visible to the affected person, indistinguishable to others.** You can tell your own access ended (a group stops resolving for you); to other members, "left" and "was kicked" look identical (no public removal mark). The app never states a reason and never auto-revokes from a health event.
- **LOCKED — Prefer routine expiry as the default** so a path going quiet is mundane background, not a pointed event.

## Linking

- **LOCKED — Encounter date defaults to today, fully customizable / back-datable;** never leaves the device, never shown to the contact.
- **LOCKED — Three paths:** link-in-chat/paste (remote default), **scan-to-autolink** (in-person QR/NFC, mutual-consent, shares an alias not the handle), capability handoff (remote persistent mutual).
- **LOCKED — Most shares need no pairing** — just send a link (key in fragment).
- **LOCKED + BUILT — Two distinct "links," only one is the profile QR.** (A) The
  **profile link/QR** — downloadable, shareable, opens the profile page ("here is my passport").
  (B) The **linkup handshake** — an in-person, low-friction **mutual proximity gesture** (tap /
  NFC / local code, NOT the profile QR) that in one act **links the two aliases AND logs a real
  encounter** ("we're hooking up"). Rules: the mutual gesture **is** the consent (no extra confirm,
  but never zero-touch ambient — both must act, so the notify graph reflects real intended
  encounters); **both blue → completes silently/warmly**; **one gray → the other sees a single
  neutral, non-alarming line** ("their testing isn't up to date right now," never why, can't
  decode — invariants 2/3), informs but never blocks/shames; already-linked → just logs the new
  encounter. The logged encounter is what creates the partner-notify edge (feeds the existing
  draft→lock→invisible flow). On-device, contentless, stores no status of the other person.
  *(Built and verified in code: the consent gate is real — only the both-acted commit writes; no
  one-sided/ambient/timer path. The gray heads-up cannot decode. The encounter writes the existing
  canonical {alias_ref, pairwise_notify_token, ts} row and feeds the existing partner flow.)*
- **LOCKED — Wallet is one pass concept, not a format menu.** The face reflects what the alias
  surfaces: QR-carrier (no status, any alias) or, for a *public* alias, an additional **Live** face
  (status on face, fail-closed gray at 24h). Only variable: "does status appear on the face,"
  gated by privacy mode. Present as "what this pass shows," not "pick a format."
- **Scope: Post-MVP (fast-follow, NOT in the handshake pass) — wallet/widget launch into the
  handshake.** The wallet and a documented home/lock-screen **quick-link widget recipe** (iOS
  Shortcut/widget, Android equivalent) can offer a one-gesture launch into the in-person handshake,
  since that flow most needs lock-screen speed. Boundary: it only **launches** the handshake;
  mutual-gesture consent still gates the link+log in-app (never a passive lock-screen trigger).
  Sequenced AFTER the in-app handshake is proven.

## Partner notification

- **LOCKED — Draft → lock → delivery.** After committing a positive + recipient list, the batch sits in a **draft window (~30 min, config constant)** the user edits freely (add/correct/remove) and can **delete entirely**; each save replaces the prior draft (last-write-wins). At the window's end the batch **locks** — historical and immutable.
- **LOCKED — Removal during draft is FRICTIONLESS** (delete-the-whole-report is the real safety valve; making it hard backfires into total silence). After lock, editing the result / removing a contact / un-linking does NOT touch the locked batch.
- **LOCKED — Post-lock mechanics are INVISIBLE to the user.** No "sending in X," no delivery status, no counts, ever — notification is deliberately removed from the user's concern (it's about recipients' health) and removing the readout also removes a leak surface. The locked batch enters the server-side send cycle.
- **LOCKED — Two separate timing jobs:** the draft window = user-facing edit grace (deterministic); the post-lock send cycle = server-side anonymity timing (cross-user batching). Don't conflate; the send cycle is never surfaced.
- **LOCKED — Content: anonymous, contentless** ("a contact suggests getting tested"); never who/when/what/count; never labeled 1:1-vs-circle. **Batched, server controls timing.**
- **LOCKED — A "get screened" nudge, not a real-time PEP alarm;** PEP urgency via always-on education; every notification routes to immediate testing + PEP info.
- **LOCKED — Reachability (MVP scope): push (primary) + pull "go get tested" page (fallback),** both identity-free. **Accepted limit:** a fully-disengaged recipient can't be force-notified. **DEFERRED (Post-MVP) — opt-in, off-by-default, blind-routed email** (content-free "go check"); phone banned.
- **ACCEPTED LIMITS (state honestly, don't overclaim):** (a) targeted push reveals to the *server* which handles received an exposure ping — mitigation direction is a generic broadcast/cover wake + a uniform "anything for me?" poll so recipients and non-recipients look identical [eng follow-up]; (b) notification anonymity is bounded by the *recipient's* in-window contact count and degrades toward deanonymizing at one contact — unfixable without not sending; distinct from the min-group-size-5 rule, which protects group status *viewing*.

## Testing reminders

- **LOCKED — Offer them: local/on-device only, supportive framing, no frequency gamification, pause-aware, discreet/disableable.**

## Onboarding & identity tech

- **LOCKED (MVP) — Passkey / Face ID / fingerprint primary; passphrase (Argon2id) fallback.** Key derived locally, never transmitted.
- **LOCKED (MVP) — A user-saved RECOVERY PASSPHRASE is REQUIRED, not optional** — it is the only no-PII recovery path. With no email/phone and on-device encryption, a saved recovery phrase (shown once at signup, save-confirmed) is the sole way back into an account after losing the device. Framed honestly: "the only way back in, we cannot recover it for you." A server-side reset is impossible by design. (The Signal / password-manager / crypto-wallet pattern.)
- **DEFERRED (Post-MVP) — Apple SSO > Google SSO** as recovery anchors (`hash(sub) → ciphertext`, decryption still gated by the user's key).
- **REJECTED / BANNED — Phone as identity, permanently.** (Smallest entropy, strongest real-identity link, universal cross-app join key.)

## Resources (US-only launch)

- **LOCKED — Four first-class "find near you" ramps, framed as tools, not verdicts:** **free testing** (Maps "free STI testing near me" + HeyMistr); **free condoms** (zip/Maps or CDC clinic-finder; no single national program exists, so no hardcoded link); **free/low-cost PrEP** (HeyMistr + PrEP assistance programs — manufacturer PAPs, "Ready, Set, PrEP," etc.); and **PEP** (the CDC "Let's Stop HIV Together" services locator, which covers testing, PrEP, PEP, and condoms; HIV.gov locator as alternate). The PrEP ramp is load-bearing: because the badge rewards active HIV protection, the app is obligated to make PrEP reachable, or it would reward privilege. **PEP urgency is contextual, not a standing label** — the standing finder says only when it applies ("after a possible HIV exposure"); the 72-hour urgency lives in the post-exposure card and education, never as a permanent alarm.

## Wallet, QR & shareable card

- **LOCKED — Wallet format is a user choice, gated by privacy mode.** **QR format** works for any
  alias and shows **no status** on the pass face (link carrier; resolution gates downstream).
  **Live-status format** shows blue/gray and auto-updates and is **public-aliases only** (it
  displays status + pings the wallet provider on a schedule).
- **LOCKED — Fail closed to gray.** Blue is valid only on a fresh confirmed read; staleness or an
  unreachable server → **gray, never stale-blue.** Staleness is **not** a distinct visible state
  and there is **no** owner-facing "couldn't refresh" message (dropped as unnecessary).
- **LOCKED — All shareable artifacts inherit every badge rule** (two-state, handle+avatar never a
  name, logo, boolean precision, no dates/streak/stamp/count). Render the alias URL as text beside
  the QR for accessibility — public/QR-carrier passes only.

## Scope

- **MVP (build now):** self-reported badge (blue/gray), pause, flat attributes, circles, aliases, push+pull notification, reminders, US resources, passkey/passphrase.
- **Post-MVP (mark, don't build):** verification (input-only), SSO, opt-in email channel.
- **Out:** viewer-visible verification, EHR integration, stranger discovery, max-group caps, real-time exposure alerting, phone-as-identity.

---

## Final whole-artifact audit (passed)

The cleaned build was run end-to-end against all 9 invariants (doc 05 rubric). **Result: zero
P0 invariant breaks** in the reachable user-facing product. Inv 2 (PrEP/undetectable both resolve
to the "On HIV prevention" umbrella) and Inv 1 (badge is derived, no direct setter; impossible
combos unreachable) independently re-verified in code. Two items were deliberately ACCEPTED rather
than fixed:

- **Knock timing (Inv-6 edge), ACCEPTED as a prototype limit.** `knock.js` runs `dedupe` only on
  the accept branch, so the real/under-limit path does observably more work than the fake/over-
  limit path. Shape is identical; timing is not strictly constant. This is unfixable-meaningfully
  in an in-memory JS mock (the timing model bears no relation to production). The real fix is the
  server-side requirement, already noted: **the production knock endpoint must do constant-time
  work across the whole write/dedupe path**, not just return a uniform string.
- **`recency:"lapsed"` overload, ACCEPTED.** An incomplete-but-clear core panel is modeled by
  writing `recency:"lapsed"` to force gray. Viewer outcome is correct (gray either way) and it's
  invisible to users; only a dev-panel reviewer toggling recency could be misled. A dedicated
  `panelIncomplete` input is a possible future refinement, not a defect.

Everything else the audit flagged was dead code/copy or a greeting, addressed in the final fix
pass (`prompt-final-fix.md`): the dead V1 contact-reach path removed as out-of-scope PII handling;
the dead four-light `StatusPill`/`ResultOption` removed to close an Inv-1 foothold; orphaned copy
pruned; home greeting de-named. *(That fix pass is deletions plus one greeting string only;
verify in code on application.)*

---

## Still open (see the Questions doc and clinical/eng follow-ups)

1. Badge equity — **for outside review:** detectable-poz can't reach blue until suppressed (and a near-universal positive state may make non-qualifiers *more* conspicuous); and PrEP-choice-normativity (declining PrEP forces the condom route or gray).
2. Syphilis serofast vs reinfection is captured as an input distinction (serofast keeps clear; rising titer breaks it). The broader "current active infection" question is resolved by the current-state-not-history rule: chronic HSV/HPV → education (never grays); transient HSV outbreak → pause. (See the LOCKED clinical block.)
3. Label-display residual — "condoms always" without the umbrella weakly implies HIV-negative-not-on-PrEP; accepted as lesser harm (3-state softens it vs. a binary); confirm.
4. Notification: push-recipient-set mitigation (broadcast wake + uniform poll); draft-window length (~30 min) and send-cycle cadence.
5. Shared-view date granularity; minimum group size (~5); scan-to-autolink auto-share default.
