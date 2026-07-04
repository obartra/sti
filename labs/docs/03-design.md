# sti.care: Design Doc

*The "how." Complete product + technical spec for the MVP. Pairs with Philosophy (why) and Decisions (what). Not legal advice. Absorbs the earlier aliases/linking spec.*

---

## 1. The badge

**Canonical definition.** **Blue** ("up to date") requires **all three**: (1) **tested within 90 days**, and "tested" means the **standard core panel: HIV, syphilis, gonorrhea, chlamydia** (the set every testing center offers, so requiring it is not an access tax), **with every *exposed* site actually covered** (see the site rule below); (2) **clear**: no current active non-HIV STI, the *only* acceptable positive being **syphilis serology from prior treated history** (not current infection); (3) **active HIV protection via at least one of three routes**: on PrEP, undetectable, **or** a public commitment to condoms-always. **Gray** = everything else. **Detectable HIV is a hard blocker, independent of route:** because the "clear" axis above is scoped to *non-HIV* STIs, a positive and not-undetectable HIV status forces gray on its own, regardless of any route, condoms-always included. For an HIV-positive person the only route to blue is **undetectable**; condoms-always and PrEP never override a detectable result.

**The site rule (why "tested" is honest, computed on-device, never displayed).** Gonorrhea and chlamydia must be checked at each site a person is *exposed* at: pharyngeal (oral), rectal (receptive anal), urogenital. A urine test alone misses most extragenital infection. Blue therefore requires, **per site, "tested clear OR not exposed there."** Someone who doesn't do oral satisfies the pharyngeal requirement by *not exposed* (no irrelevant swab forced); someone who does satisfies it by *swabbed and clear*. This keeps "tested" honest without paternalism (no test demanded for an unused site) and without privilege bias. **Critically, the per-site reasoning is computed on-device and NEVER displayed**: a viewer only ever sees blue/gray. Surfacing which sites were tested would leak behavior (testing pharyngeal implies oral sex, rectal implies receptive anal), re-creating exactly the inference the model fights. The site logic produces the badge; it never produces a viewer-facing fact.

- **Never-tested → always gray.** Blue is earned from a real recent result, never inferred from low risk or "no history"; even a virgin can have HIV.
- **No rank above blue**: one positive state. No green/yellow/red, no tiers, no "platinum," no frequency ranking.
- **The three routes surface via labels** (see §3): PrEP and undetectable share one **identical** umbrella label, "On HIV prevention," that never distinguishes them; the condom route is the **"Condoms always"** value of a 3-state condom preference (displayed "No condoms / Condoms optional / Condoms always"), shown publicly.
- **Gray is a wide, mixed bucket:** overdue, never-tested, paused, mid-treatment, HIV- detectable, and tested-but-no-qualifying-protection-route all sit in it together. That heterogeneity is what stops a single look at gray from decoding to HIV status.

**Displayed labels (what a viewer actually reads).** The blue headline **states the route that
earned blue, once**, so "HIV prevention" appears in exactly one place and means exactly one thing
(no title-vs-tag double meaning). It reads **"Tested & on HIV prevention"** when the route is PrEP
or undetectable (the umbrella, camouflaging which), or **"Tested & always uses condoms"** when the
route is the public condoms-always commitment. **Precedence: if a person has both the
PrEP/undetectable umbrella and condoms-always, the headline shows "Tested & on HIV prevention"**
(the umbrella always wins; making the headline depend on a PrEP/U=U person's condom use would leak
behavior). The route therefore does **not** also appear as a redundant tag; tags carry only the
*optional* non-route attributes. The two non-route condom-preference values ("No condoms,"
"Condoms optional") stay as optional tags and never become a headline; only "Condoms always" can graduate to
the headline, because it is the only condom value that is also a blue route. This discloses nothing
new: the headline only ever states the route the person already made public to earn blue that way.
The gray state reads **"No status shared right now"**: neutral, never a verdict, never
"expired/overdue/needs a test." (The labels still avoid "protected/safe/clean/cleared"; "up to
date" remains an internal *concept* word only.)

**Why active-protection-required (and why it's not a serostatus gate).** Sex with someone who only has a ≤90-day negative test carries a different, higher risk profile than with someone actively protected (a test is a backward-looking snapshot with a window-period blind spot; PrEP/U=U protect continuously). Requiring active protection makes blue *mean* something. It does not gate on serostatus because the positive state is reachable by the cheapest, most universal route (public condom commitment) and the app carries PrEP/condom/testing access ramps (§12). The efficacy difference between condoms and PrEP/U=U is handled by **education, not ranking** (a core commitment, not a disclaimer).

**Named costs (for outside review, not solved in code).** Detectable-poz-in-care can't reach blue until suppressed, and a near-universal positive state can make non-qualifiers *more* conspicuous; someone who declines PrEP for autonomy must use the condom route or be gray (PrEP-normative tilt). No snapshot outs anyone (wide gray bucket); a "tests yet never blue" pattern is the residual over time.

**Clinical model (resolved: the current-state-not-history rule).** "Clear" means no *current active* non-HIV STI. The general rule for any "what about condition X": the badge reflects **current state, not diagnosis history**, across three never-conflated axes. **Chronic/lifelong manageable diagnoses (HSV, HPV) → education, never the badge**: they never gray anyone, never appear as a label or attribute; a lifelong gray for a common manageable condition is the permanent-sentence trap the project refuses. **A transient active higher-transmission episode (e.g. an HSV outbreak) → pause** (§2): gray for the duration, identical to every other gray, un-paused when it clears. **Testing recency → the 90-day clock only**: an outbreak is a symptom, not a test result, and is never folded into the testing window. Untreated bacterial STIs gray until treated; detectable HIV until undetectable; **prior-treated syphilis (serofast) keeps "clear," a reinfection (rising titer) breaks it.** HPV (out entirely: education/resources only) causes *warts* and a slow vaccine/screening-managed cancer risk, not sores; do not conflate it with HSV.

## 2. Pause

How "not ready" is handled without a warning state.

- **Manual pause** anytime (symptoms, new exposure, personal choice). **An active HSV outbreak is the textbook case:** the chronic diagnosis never grays (it's education-only), but the transient outbreak, when transmission risk is genuinely higher, is a "this week" reason to pause. Education teaches that pausing during an outbreak is the considerate move and why, without shaming anyone for having HSV.
- **Auto-pause** during treatment/clearance windows: when a user records a positive result + treatment date, the app computes the standard clearance window **on-device** and pauses until it passes.
- **Extend** a pause yes; **shorten** below the minimum recommended guideline no.
- **Visibility:** pausing only ever changes the badge to gray (the user's choice is *whether*
  to pause, not a separate "paused" visibility). It renders identically to all other gray; there
  is no viewer-distinguishable pause state.
- **Invariant:** auto-pause, manual pause, never-tested, and didn't-share all render identically as gray. Never a dated/labeled "paused" state.

## 3. Protection labels & flat attributes

- **PrEP and undetectable surface ONLY under a single shared umbrella label, "On HIV prevention," identical for both and never distinguishable** (HARD INVARIANT), which lets an undetectable person blend in honestly among the PrEP majority. **"Undetectable" is never a viewer-visible attribute** (it discloses HIV-positive status); method is never shown.
- **The condom route surfaces as a 3-state preference**, displayed as **"No condoms,"
  "Condoms optional," "Condoms always"** (internal keys `raw` / `either` / `condoms_always`),
  optional and self-declared, **decoupled from how blue/gray is
  computed.** All three are displayable flat attributes (ordinary boundary/preference info). Only
  **"condoms always," shown publicly,** qualifies as the HIV-protection route for blue; the other
  two never affect the badge. Keeping all three displayable is required so "condoms always" isn't
  a lone tell (a bare binary "condoms required: yes/no" would make the qualifying value
  conspicuous). A consent boundary, not a health fact, so showing it is fine.
- **The labels are independent and independently displayable**: the umbrella and the condom
  preference can show in any combination. Neither's presence/absence implies the other, so the
  umbrella's absence stays uninformative. *Residual:* "condoms always" shown without the umbrella
  weakly implies HIV-negative-not-on-PrEP, a negative-status inference, accepted as far less
  harmful than any positive leak (open item to confirm); the 3-state preference softens this vs.
  a binary.
- **"uses condoms" and "on doxy-PEP"** remain optional self-declared flat attributes; never summed into a verdict, never colored/ranked.
- PrEP and undetectable are equivalent HIV-protection paths, but **HIV-only**, never "fully safe." Other-STI recency is a separate axis.
- **Labels/attributes show on gray too** (most useful when testing reassurance is absent) and are gated by **authorization**, never by badge color.

## 4. Groups

- A **convenience layer over pairwise links**, not a real-time alerting feed and not a "clean club." There is **one kind of group.** Whether it is a one-time **event** or a **recurring** meeting is only a cadence hint for partner-notify timing, never a second kind of group.
- **Membership is the sharing; there is no minimum size and no door.** Joining a group is itself consenting to show your blue/gray color to its members, so a headcount protects nothing. No counts ("3 of 5" outs by elimination), no leaderboards, no join gate; joining, leaving, and skipping all look ordinary. The one residual to respect: a color in a group named for a specific place or event carries more than a bare color, so group names are never forced to be descriptive.
- **Everything inside a group is fully visible to its members.** Every member sees the whole roster and each member's current color, refreshed on read. There are no hidden members, so there is no "additional private members" notice and no per-member visibility dial. You choose the **face** you appear under, your usual identity or a fresh handle, but you appear, visibly, as a member.
- **The member controls their own disclosure; the group never overrides it.** Your color in a group is whatever your own status resolves to for the face you joined with; no group-level switch can reveal a member beyond what they chose by joining. Leaving and being removed are indistinguishable to the others: the roster just changes, with no mark and no reason shown, while the affected person can tell their own access ended.
- **Membership disclosure is per-person:** revealing that a group exists never reveals who is in it; each member discloses only their own membership.
- **Discovery is member-initiated and link-scoped.** A private group is reachable only through an invite an admin sends; a public group is reachable through its findable handle, which resolves to an opaque join pointer, never to the roster. No open search, no stranger discovery, no contact intersection.
- **Roles:** the creator is the admin, and can invite people, revoke an invite before it is accepted, remove a member, and disband the group. A removal or a leave rotates the group key, so a removed member gets no future reads.
- **Anti-spam:** consensual pull, sticky declines, and outbound rate-limiting, never max-group caps.
- **The server never learns the group.** The group object (its handle, roster, and per-member wrapped key) is a sealed blob the server stores and serves exactly like a passport payload; only a member holding the group key can read the roster and the colors.

## 5. Identity & aliases (the canonical unit)

A user has **one real account**, anchored by a local key (passkey/passphrase) that is **never shown and never in a URL.** There is **no user-facing main handle.** Everything shared is an **alias.**

**Each alias has:** an opaque id (the only thing server-side), a display handle/avatar (inside the encrypted payload, obfuscating the account), a privacy mode (private/public), and validity/revocation (independent of other aliases).

**Server-blind linkage:** the account→aliases mapping lives only in the user's encrypted store. The server holds `opaque_id → ciphertext`, no handle, no avatar, no grouping, no public/private flag.

**Opaque-id aliases are the default.** A **vanity/custom handle** is an explicit *public* opt-in, taught at the choice point: "this makes you findable and is not unlinkable from anywhere else you use this name, and it points at your status, so use it only where you'd be fine being recognized."

**No real names, anywhere.** The display identity is a **handle/alias + avatar, never a
first/last/legal name.** There is no name field in the system: not stored, not optional, not
hidden. A name is a collection surface the product has no use for, so the field doesn't exist.
The avatar + handle *is* the identity on every surface (cards, wallet passes, circles, shares).

## 6. Public vs private = key distribution

The server's job is identical in both modes (store + serve opaque ciphertext). Only **who holds the key** differs.

- **Private alias:** key held only by authorized contacts (handed over at link time). Anonymous viewers get ciphertext they can't decrypt → **uniform gray-nothing**, identical to a nonexistent id. Existence hidden; handle unreadable by server and strangers.
- **Public alias:** key rides the URL fragment (`/p/<id>#<key>`), never reaching the server. Anyone with the link decrypts and sees badge + attributes. Server still never sees the handle.

**Honesty calibration:** "we can't read it" is strong for private aliases, weaker for public (anyone with the link can decrypt). A public link leaks only that alias to the user's chosen audience, categorically safer than a readable server that would leak everyone's data to one coercible party.

## 7. Resolution & existence-hiding

- Within any alias a viewer sees only **two badge renderings** (blue or gray), never a leaky third, because each alias is one mode. (The "gray-with-labels vs gray-without-labels" third state only appears if you run both intents on one alias. Don't; mint separate aliases.) **This counts badge renderings, not viewer outcomes:** the knock affordance is not a third existence-state. Cold/anonymous/guessed resolution is uniform gray-nothing, and a knock affordance appears only to a link-holder with an existence-uniform response (see §Knock). The full outcome enumeration (blue, gray, uniform gray-nothing, link-holder-gated-plus-knock) lives in the State Space doc; the invariant here is narrower: cold viewers never get a distinct existence-confirming state.
- **Uniform responses in shape AND timing:** "can't decrypt" and "doesn't exist" must be byte- and latency-indistinguishable. Serve plausible ciphertext-shaped bytes for misses; keep paths constant-time-ish.
- **Attributes gated by authorization, never by badge color.**
- **Public profiles can't be existence-hidden and are scrapeable over time** (a scheduled scraper reconstructs cadence and gray episodes). Mitigations, not a full fix: opt-in, default-off, time-boxed; coarse temporal precision ("as of [month]"); transition hysteresis (blue→gray flips on a fuzzy/batched schedule, decorrelated from the health event); per-id/per-viewer rate-limiting; and an honest in-app warning that a public profile is watchable. **Scrape resistance never requires an account: viewing a shared status stays account-free** (a core principle, and a login would add the very identity/correlation surface the model avoids). Rate-limit anonymously (per-IP/per-id, optional proof-of-work or a challenge under load), not by gating reads behind sign-in.

### Knock: visitor access to a public link, without seeing the status

A **public link** (handle + `/u/` directory) keeps the *status* gated even though the handle is findable. Anyone who visits `sti.care/u/{handle}` can **knock** (request access) and the owner decides. Private links carry the AES key in the URL fragment and give immediate access; they have no knock step. Knock is the public link's gate: findable but not immediately readable.

- **Existence-safe by uniform response (the load-bearing rule).** The knock endpoint returns the **same** "if this passport exists, your request has been sent" response **regardless** of whether the id is real, fake, guessed, or held via a shared link. Real id → owner gets a knock; fake/guessed id → identical message, nothing happens. Because the response is presence-invariant, the knock path **reveals nothing about existence**: invariant 6 stays fully intact even though a request affordance now exists. (This is the password-reset "if an account matches, you'll get an email" pattern.) **Production timing note:** "no early-return branch" is necessary but NOT sufficient: the real endpoint must equalize *total* response time including the write/dedupe/alert path (a real knock that writes a row + dedupes takes longer than a discarded no-op unless deliberately equalized). Constant-time means the *whole* path, not just the absence of an early return. The over-limit case also rides the uniform path, never a distinct 429.
- **The knock affordance is rendered client-side from the link, never a server query.** A private alias is advertised as a link carrying a **knock token in the URL fragment** (`/p/<id>#k=<knock_token>`, the fragment never reaching the server, exactly like the public-key case). The client shows the knock button only when that token is present, so a **link-holder** sees it while a **cold/guessed** visitor (bare `/p/<id>`, no fragment) does not, with **no server round-trip that could leak existence**. The token authorizes nothing on its own (knocks stay reviewed and the server response stays existence-uniform); it only decides whether the button is offered.
- **The requester sees only that uniform confirmation**: then the status either silently resolves to a badge later (granted) or stays gray-nothing forever (didn't exist, or not granted, indistinguishable). **No pending/granted/denied signal ever.** Their real-world confirmation is the conversation ("I knocked on the app"), not an app readout. A "denied" signal especially is never sent (socially costly, and a leak).
- **Always review, never auto-grant.** A knock is a request, not an entitlement; the owner grants per-knock (consistent with all sharing being owner-decided).
- **Owner alerting is a quiet persistent indicator** (a dot/badge on the alias in the Privacy surface), owner-pull, **no per-knock push, no buzz.** Discoverable when a requester says "I knocked," ambient otherwise; volume can never spam or stress.
- **Auto-expiry ~4 days** (one config constant) + a **"clear all"** bulk-dismiss. Stale knocks self-clean; a forwarded-link knock wave decays on its own; expiry sends the requester no signal.
- **Knocks are contentless and rate-limited** per requester and per id, so a single prober or a forwarded link can't flood.
- **Forwarded-link caveat (documented, not solved):** a private link is forwardable, so a stranger who gets a leaked link *can* knock. But since knocks are reviewed and contentless, a forwarded link only ever generates ignorable knocks, never status. The link reveals *existence* to whoever holds it; it never reveals *status* without a grant. Accepted.

## 8. Time-bound & revocable sharing

- Grants: point-in-time, durational, or standing-until-revoked, for individuals or groups. Durational = periodically re-serve a freshly-rotated payload; expiry/revoke = stop issuing the next one.
- **"Revoke" = "no future reads," not "unsee."**
- **Visibility and revocation are per-token / per-capability: there is NO global access state.** What a viewer sees depends on which token/alias they hold. If you're linked through two paths (a group token and a separate alias) and you leave the group, they still see whatever the other token grants; one path going dark says nothing about the others.
- **Status and access are orthogonal.** Pause changes only *what you show* to your existing audience (unpause reverses it, nothing "rejoins"). Revoke/leave changes only *who can see you via that path* (re-grant/re-join reverses it, status untouched).
- **Access changes are visible to the affected person, indistinguishable to others.** You can tell your own access ended (a group stops resolving for you); to other members, "left" and "was removed" look identical, no public removal mark, no reason ever stated. The app never auto-revokes from a health event.
- **Prefer routine expiry** (short TTLs, re-sharing as the norm) so a path going quiet is mundane and timing-independent of any health state.

## 9. Linking

- A **link** records "these two aliases encountered each other on [date]," used on-device to compute exposure windows. Lives only in each user's encrypted store.
- **Encounter date** defaults to **today**, fully customizable / back-datable; never leaves the device, never shown to the contact.
- **Paths:** (a) **link in chat/paste** (remote default; key in fragment, one tap if chat-integrated); (b) **scan-to-autolink** (in-person QR/NFC: devices exchange alias refs + pairwise notify-tokens directly, auto-link with today's date, optional mutual auto-share; a scan *proposes* a link both confirm, never silently binds; shares an **alias, not the handle**); (c) **capability handoff** (remote persistent mutual; ride the app's chat so key handoff is one tap).
- **Most shares need no pairing**, just send a link.

## 10. Partner notification

**Draft → lock → delivery (mechanics invisible after lock).** The user controls the *facts* (who they linked with) during an editable draft window; then the batch locks and the rest is not the user's concern: it's about the recipients' health.

1. **Draft window (~30 min; one config constant):** after the user commits a positive result + recipient list, the batch sits in draft. The user edits freely (add, correct, **remove**) and may **delete the entire report** at any time. Each save **replaces** the prior draft (keep only the latest; discard superseded drafts as they arrive: last-write-wins, no stack).
2. **Lock (at window's end):** the last draft standing becomes **historical and immutable.** Editing the result later, removing a contact later, or un-linking does **not** touch a locked batch.
3. **Post-lock, invisible by design:** the app tells the user **nothing** about notification timing, delivery, or recipients: no "sending in X," no delivery status, no counts, ever. The locked batch enters the next server-side send cycle, where cross-user batching + timing provide anonymity. This is deliberately removed from the user's concern, and it is its own leak-reduction (no delivery readout that could become a count/timing signal).

The user's real safety valve is **deletion**: anyone who feels exposed deletes the whole report during draft. So removal is frictionless on purpose, and anything left in is genuinely opt-in.

**Two timing jobs, kept separate (this replaces the old single "jitter"):** the **draft window** is the user-facing edit grace (deterministic, "you have ~30 minutes"); the **send cycle** after lock is the server-side anonymity timing (mixing this person's pings with everyone else's). Don't conflate them; nothing about the send cycle is surfaced to the user.

**Content:** anonymous, contentless: "a recent contact suggests getting tested." Never who/when/what/how-many; never labeled 1:1-vs-circle (one large anonymity set). A "get screened" nudge, not a real-time PEP alarm; PEP's 72h urgency lives in always-on education *independent of when the nudge lands*; every notification routes to immediate testing + PEP info.

**Server triggers, client composes (HARD RULE).** The server's only job in delivery is to *wake*
the recipient, the contentless "there's something for you" ping. **All conditional rendering
happens on the recipient's own device** against locally-held status: which message variant shows,
whether the PEP card appears or is suppressed, etc. The server never learns which variant
rendered, so no status-correlated tell is created on an anonymous surface. Corollary: any surface
without trustworthy local status (the anonymous pull "go get tested" page, opened via an opaque
link with no app state) shows PEP/testing info **unconditionally**: it has nothing to gate on and
gating would require a lookup that leaks.

**Reachability (MVP scope):**
- **Push (primary):** the push token is an opaque, rotating, device-scoped endpoint (not email/phone), and it **wakes a closed app.** Encourage keeping push on.
- **Pull "go get tested" page (fallback):** recipient holds an opaque link to their own status inbox; opening it shows the nudge + resources. No stored identifier, works web-only or push-off, but only if they come back and check.
- **Accepted limit:** a fully-disengaged recipient (uninstalled, push off, never checks) can't be force-notified, because the only channels that reach a non-app user are the identifiers we don't hold.
- **Deferred Post-MVP:** optional, off-by-default, blind-routed **email** (hashed token, content-free "go check" only); phone stays banned.
- **Honest limits (don't overclaim):** (a) targeted push reveals to the *server* which handles received an exposure ping; the mitigation direction is a generic broadcast/cover wake plus a uniform "anything for me?" poll, so recipients and non-recipients look identical [eng follow-up]. (b) Notification anonymity is bounded by the *recipient's* own in-window contact count: at one in-window contact it deanonymizes that contact, and no jitter fixes that. This is inherent to partner notification and is distinct from the min-group-size-5 rule (which protects group status *viewing*, a different mechanism).

## 11. Testing reminders

- **Local/on-device only** (from the user's cadence + last-test date, both already on-device); the server never learns whose window is lapsing.
- **Supportive framing,** routing to the testing finder; never nagging or shaming.
- **No frequency gamification** (no "monthly = better"). v0 ships a single 3-month cadence (it matches the badge window); finer cadence options are a later refinement.
- **Pause-aware:** suppressed during a treatment pause, resume after.
- **Optional, discreet, disableable** (lock-screen privacy).

## 12. Resources (US-only)

Four first-class "find near you" ramps, framed as tools, not verdicts:
- "Find free testing near you" via Google Maps "free STI testing near me" plus HeyMistr.
- "Find free condoms near you" via a zip/Maps finder or the CDC clinic-finder (no single national program exists, so no hardcoded link).
- "Find free/low-cost PrEP near you" via HeyMistr plus PrEP assistance programs (manufacturer PAPs, "Ready, Set, PrEP," etc.). **Load-bearing:** because the badge rewards active HIV protection, the app is obligated to make PrEP reachable, otherwise it rewards privilege.
- "Find PEP near you" via the CDC "Let's Stop HIV Together" services locator (covers testing, PrEP, PEP, and condoms) or HIV.gov's locator.

**PEP urgency is CONTEXTUAL, not a standing label (tone rule).** PEP is only time-critical *if a person has had a possible HIV exposure and is not otherwise protected*. So the urgency framing ("72 hours, the sooner the better, go now") belongs in the **post-exposure context** (the on-device-composed PEP card that appears after a possible exposure, and the always-on education). In the **standing resource finder**, "Find PEP near you" must be a NEUTRAL finder label like its siblings, not a permanent "time-critical, go now" alarm. A permanent urgency label is alarming and usually false for whoever is browsing, and it violates the project's normalize-don't-alarm tone. The standing subtitle states *when* PEP applies ("after a possible HIV exposure") rather than shouting urgency at everyone.

## 12b. Education layer: the product implies behaviors; education has to teach them

The product repeatedly *implies* expected actions without spelling them out, and several harm-
reduction decisions only hold if education does the teaching. Education is not a static "Learn"
tab to bury; it is **load-bearing infrastructure** that the rest of the model leans on (efficacy
nuance, the clinical model, PEP urgency, and what blue does and doesn't mean are all discharged
*here* rather than through labels or ranking). Treat it as a first-class surface.

What it must carry, and *when* it should surface (contextual, not just a library):

- **What blue actually means (and doesn't).** Blue is "tested in window, clear of current active
  non-HIV STIs, HIV-protected, as this person reports it", **not** "safe," "disease-free," or a
  test result. Taught at onboarding and reachable from any badge.
- **The clinical model, de-stigmatized.** Chronic HSV/HPV are common and manageable and **do not
  belong on a badge**: having them doesn't make a profile "worse." This copy must be written so
  it never shames people who have these conditions while still teaching the transient-outbreak
  behavior. (This is a real writing responsibility, flagged for whoever drafts it.)
- **Pause-during-outbreak.** That an active HSV outbreak is a higher-transmission window and
  pausing is the considerate move, taught as care, not punishment; surfaced near the pause
  control and in HSV education.
- **PEP urgency, always-on.** The 72h window, what PEP is, and "go now if you think you were
  exposed", available independent of any exposure event (so the exposure-alert card can stay calm
  and act as a reminder, not the sole source). Lead with the option, not the worry.
- **Efficacy nuance.** That condoms, PrEP, and U=U are all real HIV protection but differ in
  efficacy and mechanism, the place the badge's deliberate flattening (one umbrella, condom route
  qualifies) is honestly explained rather than ranked.
- **Vaccination & screening.** HPV vaccine, cervical/anal screening, hep, etc.: the prevention
  actions for the conditions the badge deliberately leaves off, available to everyone, status-free.
- **What to do at each moment with the product**, a light "expected actions" through-line: at
  onboarding (what this is / isn't), on a positive result (treat, the notify flow, auto-pause), on
  an exposure nudge (test, PEP if recent), on a lapse (re-test), during an outbreak (pause). The
  product's implied behaviors made explicit and supportive, never shaming.

Tone rule for all of the above: supportive, non-shaming, non-clinical-policing; it informs so the
person decides, consistent with the rest of the product. (U=U-style explainer copy already in the
build is the model for this voice.)

## 12c. The stranger explainer: what a logged-out first-timer sees

The highest-traffic education surface is the **resolved card a logged-out stranger lands on from a
shared link** (a Grindr/Sniffies profile, a DM). They have no account, no context, and will
mostly not tap anything. If they misread the badge, the signal is worse than useless: blue
misread as "no condom needed," gray misread as "this person is dirty." This explainer exists to
prevent both misreads, at a low reading level, calmly. It lives **on the resolution page itself,
no account required**, not buried in an in-app Learn tab they'll never open.

**On the card (always visible): the label + one plain sentence.** For blue:
- Label: **"Tested & on HIV prevention."**
- Sentence (~6th to 8th grade, active voice, no jargon): e.g. *"[handle] says they've tested
  recently and take steps to prevent HIV. The tags show what they've chosen to share. They're
  telling you themselves. It's not a lab result."* This carries both halves, sets the trust level
  ("they're telling you," "not a lab result"), and avoids "safe."

**Every rendered card (blue OR gray) has the IDENTICAL "What does this mean?" affordance**, same
placement, same target, opening the same explainer. A gray card never gets a different or lesser
explainer than a blue card: that asymmetry would itself be a viewer-distinguishable tell AND would
re-stigmatize gray. (Gray-*nothing* = the private/unauthorized cold view is **not a card** (no
handle, badge, or affordance, indistinguishable from nonexistent), so there is nothing to explain
and no inconsistency; see §7. The explainer question only arises for a *rendered* card.)

**The tap-through explainer covers, in plain words, in this order:**
- *What blue means:* "They've had the standard STI test (HIV, syphilis, gonorrhea, chlamydia) in
  the last 3 months, it came back clear, and they're actively preventing HIV."
- *What it does NOT mean:* "It's a good sign, not a guarantee. No test catches everything, recent
  exposures can take time to show up, and things change. It doesn't mean 'no risk', and it's
  always fair to ask what they tested for and when. Keep doing what keeps you comfortable." (The
  critical anti-complacency + scope line: it teaches that "tested" has a scope and a window, so a
  partner knows it's reasonable to ask, without the badge having to itemize.)
- *What gray means (de-stigmatized, equal airtime):* "Gray just means there's no status to show
  right now. Lots of ordinary reasons: between tests, hasn't tested lately, or just keeps it
  private. **It is not a red flag and does not mean they have an STI.**"
- *What to do with it:* "Use it to start a conversation, not to skip one."

**Tone/legibility rules:** lead with what things *are*, never with risk/warning; no red, no
warning icons, no "caution" language; everyday words ("tested" not "screened," "prevent HIV" not
"biomedical prophylaxis"); short sentences; second person. Gray is explained with the **same calm
and equal weight** as blue. Do not promise more granularity than the privacy model allows: a
stranger sees "On HIV prevention" but can never tell PrEP from undetectable (§3 invariant), so the
copy says "the tags show what they share," never "the tags tell you how they protect."

## 12a. Wallet passes, QR & shareable card


The shareable artifacts (Apple Wallet pass, Google Wallet pass, standalone shareable card image)
all inherit every badge rule: two-state only, handle + avatar (never a name), sti.care logo,
boolean precision (no dates/freshness/streak), no stamp, no count.

**Format is a user choice, gated by privacy mode:**
- **QR format: works for ANY alias (public or private).** The pass face shows **no status**:
  just the QR + handle + avatar + logo. It is a *link carrier*; downstream resolution gates
  everything (public → viewer sees the badge; private + authorized → sees it; private +
  unauthorized → uniform gray-nothing; a link-holder may **knock** per §7, but the anonymous/
  guessed view shows no knock affordance and the response is existence-uniform). This
  is how private users carry a pass safely: the pass leaks nothing, resolution does the gating.
- **Live-status format: PUBLIC aliases only.** The pass face shows blue/gray and auto-updates.
  It can only be public because it (a) displays status on the face and (b) auto-update pings the
  wallet provider on a schedule (a metadata channel acceptable only for an already-public alias).
  Turning Live on forces/confirms public.

**Fail closed to gray.** Blue is valid only on a fresh, confirmed read. If the pass can't refresh,
the server is unreachable, or the last sync is older than the **freshness window (24h, one config
constant)**, the pass shows **gray, never stale-blue** (stale-blue would assert "up to date" the
app can't confirm; the worst false positive). The 24h window is a *liveness* guard, not the 90-day
clinical window: it only governs whether a Live pass can still vouch for its blue. Staleness is
**not** a distinct visible state and there is **no** owner-facing "couldn't refresh" message:
stale simply renders as ordinary gray (the owner opens the app to check).

**Accessibility:** render the alias URL as text beside the QR (screen-readers, manual entry), but
only on QR-carrier / public passes; never as a private-status assertion on a pass face. The QR/URL
encode an **alias** (opaque, or a public vanity handle), never a cross-linking account id.

**Public-profile use (e.g. a status on a Grindr/Sniffies profile): share a resolving link/QR, not
a baked-in status image.** The primary shareable for an on-profile context is the **link/QR that
resolves live on tap**, so there is no status snapshot to go stale in someone's profile or chat
history (a screenshot of a QR is just the same working QR). A status *image* may be offered but is
explicitly framed as a snapshot ("scan for current"); it is never the default. This is what lets a
**private** user advertise on a public profile without going public: the link resolves to gated/
knock for strangers, full for the authorized; the badge is never scraped or frozen into an image.

**Wallet presentation (framing).** The wallet is not a three-way "pick a pass type" menu. It is
**one pass concept** whose face simply reflects **what the alias surfaces**: a private (or any)
alias surfaces a QR-carrier face (no status, link only); a *public* alias can additionally surface
a **Live** face (status on the face, auto-updating, fail-closed to gray at 24h). So the only real
variable is "does status appear on the face," and that is gated by privacy mode (Live requires
public). Present it as "here is what this pass shows," not as a menu of formats.

**Fast-follow (Scope: Post-MVP, NOT built in the wallet pass): a "quick link" launch into the
linkup handshake.** The wallet (and a documented home/lock-screen **widget recipe**) can offer a
one-gesture launch into the in-person **linkup handshake** (§9 / its own pass), because that flow's
whole value is lock-screen-speed, and opening the app is the friction it exists to remove. Crucial
boundary: the wallet/widget only **launches** the handshake; the **mutual-gesture-is-consent** rule
still gates the actual link+log in-app (never a passive lock-screen trigger, the pocket-tap risk).
This is sequenced AFTER the handshake is proven on its own: build the in-app handshake first, then
add the wallet/widget entry as a fast-follow. The widget recipe is a documented production pattern
(an iOS Shortcut/widget, Android equivalent), not prototype code.


**On device** (inside a passphrase/passkey/biometric-derived encrypted blob; server stores only the ciphertext, for cross-device sync): diagnoses, test/treatment dates, badge + clearance math, the full contact graph (per-link opaque notify-tokens, link dates, group membership), alias definitions, visibility preferences.

**On the server** (cleartext but blind): `opaque_alias_id → ciphertext`; `hash(notify_token) → opaque_handle` for routing; push endpoints; the user's unreadable encrypted blob; a batched outbound send-cycle queue (cross-user timing for anonymity). The server **triggers** delivery (a contentless wake) but never composes content or learns which on-device variant rendered; all conditional rendering is client-side against local status.

**Keys:** derived locally via Argon2id (passphrase) or passkey/WebAuthn-PRF/biometric; never transmitted. A user-held recovery passphrase is REQUIRED (see below), never a server-side "reset" implying we hold the key.

**Pairwise links** are exchanged device-to-device (QR/NFC/private link); the server never sees the pairing, and a group is a client-side bundle of pairwise links; the server never learns a group exists or who's in it.

**The server CAN learn:** a handle/endpoint exists; that some tokens got pinged; ciphertext sizes. **It CANNOT learn:** the social graph, group membership, any diagnosis, any test/treatment date, or how many contacts anyone has. **Caveat (honest):** with naive *targeted* push, the server would observe *which* handles receive an exposure ping (a recipient set). Closing this requires the broadcast-wake + uniform-poll mitigation (§10); until that's built, "who got notified" is not fully blind, and the docs should not claim otherwise.

**Decorrelation & side channels:** behavioral unlinkability between sibling aliases (no shared session/IP/push fingerprint); notify-token rotation; uniform timing/shape for resolution and delivery; silent/generic push ("New update") so providers don't learn "exposure."

## 14. Onboarding & scope

- **MVP (build now):** passkey/biometric as the primary unlock, **plus a user-saved recovery
  passphrase** (see below). Self-reported badge, pause, attributes, circles, aliases, push+pull
  notification, reminders, US resources.
- **Account recovery is REQUIRED, not optional, and is the only no-PII recovery path.** Because the
  system stores no email/phone/PII and the data is on-device-encrypted, the *only* way back into an
  account after losing the device/passkey is a recovery phrase the **user saved themselves**. So
  onboarding must generate a recovery passphrase, show it once, and make the user save/confirm it,
  framed as "this is the only way back in, we cannot recover it for you" (the Signal / password-
  manager / crypto-wallet pattern). A server-side "reset" is impossible by design (it would require
  PII to send to, and we hold no key). Passkey-only with no recovery = lose-device-lose-everything,
  which is unacceptable for a health passport. Email/magic-link as account identity stays BANNED
  (a correlation handle and PII honeypot); the recovery phrase is the substitute.
- **Post-MVP (mark, don't build):** verification (input-only, never viewer-visible), Apple/Google
  SSO (`hash(sub) → ciphertext`), opt-in email channel.
- **Out:** viewer-visible verification, EHR integration, stranger discovery, max-group caps,
  real-time exposure alerting, phone-as-identity.

---

## Open items

- Badge equity (for outside review): detectable-poz can't reach blue; PrEP-choice-normativity.
- "Current active infection" definition (clinical; HSV/HPV never permanently gray; syphilis serofast vs reinfection).
- Label-display residual (condoms-without-umbrella implies HIV-negative); confirm acceptable.
- Notification: push recipient-set mitigation (broadcast wake + uniform poll); draft-window length + send-cycle cadence.
- Shared-view date granularity; scan auto-share default. (Minimum group size is closed: no floor, see doc 31.)
