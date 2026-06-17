# Designer-agent audit prompt

*Standalone. The design agent has not seen the rationale — this is the full rubric. Paste as
is.*

```
You are auditing the current designs for a US-only STI status app ("passport") that includes
user-created groups ("Circles") and a per-alias sharing model. You have not seen the
rationale; this prompt is the full rubric. Do NOT implement anything. PROPOSE changes only,
with enough context that a human can decide. Go through every page, component, state, copy
string, color, and workflow, one at a time.

For EACH item report: Item / What it does now / Verdict (ALIGNED / NEEDS CHANGE / REMOVE /
UNSURE) / Why (cite the principle) / Proposed change + rationale / Open question.

0. PURPOSE & STANCE.
This app makes testing and disclosure easier and more normal and helps people make
science-based decisions. It is support and harm reduction, NEVER a filter that sorts people
or a gate that decides who may have sex. Where a choice could read as "come in, here's free
testing nearby" OR "you don't belong until compliant," it MUST take the former. Flag anything
whose social function is exclusion.

1. BADGE — blue / gray only, ONE positive state (no rank above blue).
BLUE ("up to date") requires ALL THREE: (1) tested within 90 DAYS, where "tested" = the STANDARD
CORE PANEL (HIV, syphilis, gonorrhea, chlamydia) WITH EVERY EXPOSED SITE COVERED — per-site
"tested clear OR not exposed" (pharyngeal/rectal/urogenital), computed on-device, NEVER displayed
(showing tested sites leaks behavior); (2) CLEAR — no current active non-HIV STI, the only
acceptable positive being syphilis serology from PRIOR TREATED history (not current infection);
(3) ACTIVE HIV PROTECTION via at least one of three routes — on PrEP, undetectable, OR a public
commitment to condoms-always. A urine-only or core-incomplete test does NOT qualify for blue
(falls to gray). NEVER-TESTED = ALWAYS GRAY (blue is earned from a real result, never inferred — even a virgin
can have HIV). GRAY = everything else (overdue, never-tested, paused, current active
infection, or no qualifying protection route) — a wide mixed bucket; that heterogeneity is the
privacy. Flag: green (reads as go), yellow/red (warning states decode to "has something now"),
ANY rank/tier/"platinum" above blue, a "recently-tested ⇒ low viral load" route (false), or
any badge whose value exposes method or exact status.

2. PAUSE.
Manual anytime; AUTO-PAUSE during treatment/clearance windows computed ON DEVICE. Extend yes,
shorten below the minimum guideline no. Visibility is the user's choice. INVARIANT: auto-pause
/ manual pause / never-tested / didn't-share all render IDENTICALLY as gray — never a
dated/labeled "paused" state. Flag any distinct or timestamped pause UI.

3. PROTECTION LABELS & FLAT ATTRIBUTES — never ranked.
PrEP and undetectable surface ONLY under a SINGLE SHARED UMBRELLA LABEL, "On HIV prevention,"
IDENTICAL for both and never distinguishable (HARD INVARIANT) — this camouflages undetectable
people among the PrEP majority. "Undetectable" is NEVER a viewer-visible attribute (it
discloses HIV-positive status); method never shown. CONDOM PREFERENCE is a 3-STATE optional
self-declared attribute — "No condoms", "Condoms optional", "Condoms always" — DECOUPLED
from blue/gray. All three are displayable flat attributes; ONLY "condoms always", shown
publicly, qualifies as the HIV-protection route for blue (the other two never change the badge).
All three must remain displayable so "condoms always" isn't a lone tell. The umbrella and the
condom preference are INDEPENDENT; neither's presence/absence implies the other. (Known residual:
"condoms always" without the umbrella weakly implies HIV-negative-not-on-PrEP — flag if any
design sharpens this; the 3-state softens it vs. a binary.) "uses condoms" and "on doxy-PEP"
remain optional flat attributes, never summed into a verdict, never colored/ranked. PrEP and
undetectable are equivalent HIV-protection paths but HIV-ONLY — never "fully safe"; other-STI
recency is a separate axis. Labels/attributes SHOW ON GRAY too and are gated by AUTHORIZATION,
never by badge color. Flag any label visibility tied to blue/gray, any visible "undetectable,"
any way to distinguish PrEP from undetectable, a binary (not 3-state) condom control, or the
umbrella being forced/suppressed by the condom choice.

4. NO VERDICTS.
No "safe," "safe to top/bottom," per-act guidance, risk scores, condom-conditional badge
states. Surface facts; the human concludes. (Note: a stated condom preference is a consent boundary,
not a verdict — allowed.)

5. NO VERIFICATION OR "SELF-REPORTED" MARK.
The MVP is entirely self-reported. With no contrast class, NO verified/unverified/self-reported/
checkmark/lock mark anywhere viewer-facing (it implies a missing tier and is itself a status
signal). Honesty is plain, low-reading-level copy, one sentence: "[handle] says they've tested
recently and take steps to prevent HIV; they're telling you themselves — it's not a lab result."
Any future verification is INPUT-ONLY and must NEVER change
the viewer-facing output. Flag any trust mark or any design that would force a viewer-visible
change if results were connected later.

6. CIRCLES.
A convenience over pairwise links — NOT a live status feed, NOT a "clean club." Permanent or
event-based. Group-level status comms require a MINIMUM GROUP SIZE (~5); no counts ("3 of 5"
outs by elimination), no leaderboards; joining/leaving/skipping looks ordinary. PER-GROUP
handle visibility (private by default) + a universal "there may be additional private members"
notice. Membership disclosure is PER-PERSON; revealing a group's existence never reveals its
members. Discovery = member-initiated, link-scoped only (no open search/stranger discovery).
Anti-spam via pull + sticky declines + rate-limiting, NOT max-group caps. Flag any
leaderboard, ranking, count, exclusion dynamic (e.g. a "door"/"bouncer"/"the bar" entry gate),
stranger discovery, or server-stored group membership.

7. IDENTITY & ALIASES.
NO user-facing "main handle." The only ids are ALIASES (opaque id in URL + display handle/avatar
inside the encrypted payload). NO REAL NAMES ANYWHERE — display identity is a HANDLE/ALIAS +
AVATAR, never a first/last/legal name; there is NO name field in the system (not stored, not
optional, not hidden). The local account key (passkey/passphrase) is never shown, never in a URL.
Opaque-id aliases are the DEFAULT; a vanity/custom handle is an EXPLICIT public opt-in, taught at
the choice point (findable, not unlinkable, points at status). Aliases are creatable/revocable/
multiple — nothing permanent or canonical. Flag any single canonical or permanent handle, any
person-NAME display (e.g. "Sam Rivera") or name input field, any handle stored server-side in
cleartext, any searchable handle directory, or vanity handles offered as the default share.

8. PUBLIC vs PRIVATE = KEY DISTRIBUTION.
Private alias: key held by authorized contacts; anonymous viewers get UNIFORM gray-nothing
(identical to nonexistent — no name, no avatar, no "is private," no request button on the
anonymous/guessed view). Public alias: key in the URL fragment; anyone with the link sees badge +
attributes; existence waived. Two observable states per alias, NEVER a leaky third
(gray-with-labels vs gray-without-labels appears only if both intents run on one alias — flag
it). Uniform responses in SHAPE AND TIMING (existence-hiding must not leak via size/latency).
Public profiles are scrapeable: must be opt-in/DEFAULT-OFF/time-boxed, ideally login-gated,
with coarse temporal precision, transition hysteresis, rate-limiting, and an honest watchable
warning. KNOCK (stranger access to a private profile): a link-holder may request access; this is
existence-safe ONLY IF the knock endpoint returns an IDENTICAL "if this passport exists, your
request was sent" for real, fake, and guessed ids (presence-invariant), the requester gets NO
pending/granted/denied signal, knocks are reviewed (never auto-grant), contentless, rate-limited,
and auto-expire (~4 days, clear-all). The owner is alerted only by a QUIET persistent indicator
(no per-knock push). For the on-profile use case, the shareable is a RESOLVING link/QR, never a
baked-in status image (no stale snapshot). Flag any always-resolving profile, any default-public
sharing, a knock response that differs for real vs fake ids (existence leak), any approve/deny
signal sent to the requester, per-knock push spam, a baked-in status image as the default share,
or any of these protections missing.

9. TIME-BOUND & REVOCABLE SHARING.
Grants: point-in-time, durational, or until-revoked; PREFER routine expiry as the default
(e.g. 30-day links) over until-revoked. "Revoke" = no future reads, not unsee. VISIBILITY AND
REVOCATION ARE PER-TOKEN / PER-CAPABILITY — there is NO global access state; what a viewer sees
depends on which token/alias they hold, so leaving one group/path doesn't change what you share
via another token or alias. STATUS and ACCESS are orthogonal: pause changes what you show
(unpause reverses, nothing rejoins); revoke/leave changes who can see you via that path
(re-grant reverses, status untouched). Access changes are visible to the AFFECTED PERSON (they
can tell their own access ended) but "left" and "was removed" look IDENTICAL to other members
(no public removal mark, no reason ever stated); the app never AUTO-revokes from a health
event. Flag any global access state, any coupling of status and access, any public "left vs
removed" or "ACCESS REVOKED" distinction that reveals a reason, or any automated access change
triggered by a health event.

10. LINKING.
A link records an encounter + date, used on-device for exposure windows. Encounter date
defaults to TODAY, customizable/back-datable, never leaves the device, never shown to the
contact. Linking should be SILENT — the contact is never told they were logged (no
"@x logged a linkup with you," no add-back suggestion). Scan-to-autolink (QR/NFC) must PROPOSE
a link both confirm (never silently bind) and share an ALIAS, not the handle. Flag any
notification that reveals the logger or the encounter, silent binding, or handle exposure on
scan.

11. PARTNER NOTIFICATION.
Draft → lock → delivery. After the user commits a positive + recipient list, the batch sits in
a DRAFT WINDOW (~30 min, one config constant) the user edits freely — add, correct, REMOVE —
and may DELETE THE WHOLE REPORT at any time; each save replaces the prior draft (last-write-
wins). At the window's end the batch LOCKS: historical and immutable (editing the result,
removing a contact, or un-linking later does NOT touch a locked batch). Removal during draft
must be FRICTIONLESS; the real safety valve is delete-the-whole-report. POST-LOCK, the app
tells the user NOTHING about notification timing, delivery, or recipients — no "sending in X,"
no delivery status, no counts, EVER; mechanics are invisible by design (it's about recipients'
health, and a delivery readout is itself a count/timing leak). Two separate timing jobs: the
draft window = user-facing edit grace (deterministic); the post-lock server-side SEND CYCLE =
anonymity timing (cross-user batching), never surfaced. Content: anonymous, contentless ("a
recent contact suggests getting tested"); NEVER who / what (no "tested positive for an STI") /
when / count (no "2 partners"). Never labeled 1:1-vs-circle; merge circle exposure into the
same contentless pipeline (no per-circle "N notified" counts). Server controls timing; rely on
batching rather than a hard per-user K-anonymity threshold that blocks low-partner users. A
"get screened" nudge, not a real-time PEP alarm; PEP's 72h urgency lives in always-on education
independent of when the nudge lands; route to immediate testing + PEP info. Reachability: push
(primary) + pull "go get tested" page (fallback), both identity-free. SERVER TRIGGERS, CLIENT
COMPOSES: the server only wakes the recipient (contentless); ALL conditional rendering (message
variant, PEP card suppress/soft/show) happens on-device against local status, so the server never
learns which variant rendered. The anonymous pull page (no local status) shows PEP/testing info
UNCONDITIONALLY. Flag any status-conditional element whose outcome is observable server-side or on
an anonymous surface (it's a status-correlated tell), any PEP/variant gating that requires a
status lookup/fetch, any FRICTION on removing a draft contact, any indefinite "pause/decline
delivery" affordance, ANY post-lock delivery/timing/recipient/count readout shown to the user, any
notification revealing source/content/count, any blame/shame copy, or any deanonymizable timing.

12. TESTING REMINDERS.
Local/on-device only; supportive framing routing to the testing finder; NO frequency
gamification (no streaks, heatmaps, "monthly = better," or any cadence shown to viewers);
pause-aware (suppress during treatment); discreet/disableable. Flag any viewer-visible testing
cadence, streak, or "test more = better" framing.

13. LANGUAGE & THE STRANGER EXPLAINER.
Ban: clean, dirty, clear, healthy (as status identity), safe, disease-free, verified,
unverified, "protected" (reads as "you're safe"), and "negative" as identity. The blue headline
STATES THE ROUTE the person already made public to earn blue: "Tested & on HIV prevention" for the
PrEP/undetectable umbrella (which ALWAYS wins and never distinguishes the two), or "Tested & always
uses condoms" ONLY when condoms-always is the route (legitimate because that preference is already
shown publicly — it discloses nothing new; a PrEP/U=U person's condom use never changes it). This
route-statement is intended and is NOT a "sharpening" of the condom residual — do not flag it. gray
= "No status shared right now." ("Up to date" is an internal concept word, not a displayed label.)
Gray / no badge / declining to share must never read as a bad result (no "expired," "needs a
fresh test," "waiting"). "Negative" is fine as a clinical RESULT INPUT, never viewer-facing.
STRANGER EXPLAINER: a logged-out first-timer landing on a shared card must be able to learn what
the badge means WITHOUT an account, on the resolution page (not a buried Learn tab). EVERY
rendered card (blue OR gray) carries the IDENTICAL "What does this mean?" affordance opening the
same explainer (asymmetry = a viewer-distinguishable tell AND re-stigmatizes gray). Gray-nothing
(cold view) is not a card and has no affordance. Explainer must be low-reading-level (6th-8th
grade), lead with what things ARE (no red/warning language), explain gray with EQUAL calm
("not a red flag, not an STI"), include the anti-complacency line (blue is "a good sign, not a
guarantee, not 'no risk'"), and say "the tags show what they share" NOT "tell you how" (never
promise PrEP-vs-undetectable granularity the model hides). Flag: the blue label reading
"safe/protected/cleared"; any card whose "what does this mean" affordance differs between blue and
gray; an explainer that alarms or treats gray as lesser; copy promising method granularity; or the
explainer being account-gated / unreachable by a logged-out stranger.

14. ANTI-GATE / HARM REDUCTION.
Not sharing or not having a badge must be indistinguishable from any other reason; the badge
is deliberately too blunt to sort people. Education states risk plainly and points to RAMPS
(free testing, PrEP, doxy-PEP, condoms) — NEVER abstinence verdicts like "you shouldn't be
having sex," never pathologizing the not-up-to-date user.

15. PRIVACY / ARCHITECTURE (UX-level).
All sensitive logic and data (diagnoses, dates, badge/clearance math, contact graph, aliases,
group membership) live ON DEVICE in an encrypted blob; the server stores only ciphertext +
opaque routing tokens. No account to VIEW a public alias. Per-app aliases unlinkable. No
central who-has-what, no server-side social graph, no searchable handle directory, no
analytics/ad SDKs near health surfaces. Consent at creation, working delete/revoke, minimal
retention. Flag any cross-app identity graph, searchable directory, plaintext health/graph
store, or tracker.

16. RESOURCES (US-only).
Four first-class "find near you" ramps, framed as tools (not verdicts): "free testing" (Maps
"free STI testing near me" + HeyMistr); "free condoms" (zip/Maps or CDC clinic-finder; no
hardcoded national link); "free/low-cost PrEP" (HeyMistr + PrEP assistance programs); and "PEP"
(CDC "Let's Stop HIV Together" locator). PEP urgency is contextual: the standing finder states
only when it applies ("after a possible HIV exposure"), never a permanent "go now" alarm.
Confirm all three present and prominent. The PrEP ramp is load-bearing — the badge rewards
active HIV protection, so PrEP must be reachable or the app rewards privilege. Flag if any of
the three is missing or buried.

17. WALLET / QR / SHAREABLE CARD.
All shareable artifacts (Apple Wallet pass, Google Wallet pass, standalone shareable card)
inherit EVERY badge rule: two-state, handle+avatar (NEVER a name), sti.care logo, boolean
precision (no dates/freshness/streak), no stamp, no count. FORMAT is a user choice gated by
privacy mode: "QR" format works for ANY alias and shows NO status on the pass face (link carrier;
downstream resolution gates everything). "Live-status" format shows blue/gray + auto-updates and
is PUBLIC ALIASES ONLY (turning it on forces/confirms public). FAIL CLOSED TO GRAY — blue is
valid only on a fresh confirmed read; staleness or an unreachable server → gray, NEVER
stale-blue; staleness is NOT a distinct visible state and there is NO owner-facing "couldn't
refresh" message. Render the alias URL as text beside the QR for accessibility, public/QR-carrier
passes only; QR/URL encode an ALIAS, never a cross-linking account id. Flag any status shown on a
QR-format face, any Live format on a private alias, any stale-blue or distinct stale state, any
date/freshness/streak/name on a pass, or a private-status assertion on a pass face.

18. ERROR, EMPTY, LOADING & OFFLINE STATES.
Every async or fallible surface needs a defined non-happy state, and NONE may leak. (a) A
render/runtime crash shows a calm, branded "something went wrong — try again" with a retry/reload,
SCOPED (an error boundary per major screen) so one failure never blanks the whole app; never a raw
stack or white screen. (b) Resolving a shared card that fails (bad key, decrypt error, network)
must FAIL CLOSED to the SAME uniform gray-nothing as a nonexistent id — never "couldn't decrypt,"
"this passport is unavailable," or any message that distinguishes broken-real from nonexistent (an
existence leak). (c) Stale or unreachable wallet/live card → gray, never stale-blue, with NO
owner-facing "couldn't refresh" text (consistent with the wallet rule). (d) Loading states must be
uniform in shape AND timing for real vs miss (no spinner that appears only for real aliases).
(e) Empty states (no results yet, no circles, no notifications) read supportively, never as a bad
result. Flag any error/empty/offline state that names a condition, distinguishes broken-real from
nonexistent, reveals a decrypt/network reason on a resolution surface, shows stale-blue, or dumps a
raw error.

FINAL SECTION — flag every: badge that exposes method/status; any rank/tier above blue;
warning state; never-tested rendered as anything but gray; any way to distinguish PrEP from
undetectable, or the umbrella label being forced/suppressed by the condom choice; label tied
to badge color or any visible "undetectable"; any person-NAME display or name field; a binary
(not 3-state) condom control; stale-blue or any distinct stale wallet state, Live wallet on a
private alias, or status shown on a QR-carrier face; verification/self-reported mark; leaky third
resolution state; existence leak via response shape/timing; global access state or status↔
access coupling or auto-revoke from a health event; public "left vs removed" distinction;
FRICTION on removing a draft notification contact, any post-lock delivery/timing/count readout
shown to the user, or any notification revealing
source/content/count; linking that reveals the logger; a main handle / cleartext handle /
searchable directory / vanity-as-default; viewer-visible testing cadence/streak; missing or
buried PrEP/condom/testing access ramp; banned language; gate or shaming copy (door/bouncer/
the-bar); privacy leak / tracker / server-side plaintext; any error/empty/offline state that leaks
(names a condition, distinguishes broken-real from nonexistent, reveals a decrypt/network reason on
a resolution surface, shows stale-blue, or dumps a raw error); and open decisions for the human
(each with options + your recommendation — e.g. exact date vs "as of [month]" vs boolean on
the shared view).

Output the full review. Change nothing.
```
