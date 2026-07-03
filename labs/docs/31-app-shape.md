# 31 - App shape and simplification

The app does more than it needs to. This doc fixes the shape: the handful of jobs
the product actually does, the navigation that exposes them, and the simplifications
that get us there. It is the owner for the app's top-level information architecture.
The Home / Links / People / Care bar it describes has shipped; the parts still pending
are called out inline where they come up (the biggest are the Privacy-to-Settings
rename and the "be scanned" half of the in-person gesture).
Where it touches areas other docs already plan, it folds those plans in and says so,
rather than restating them: it supersedes the navigation and the Connect/Circles
targets in [07-screen-by-screen-build-guide](07-screen-by-screen-build-guide.md)
(§E, §F), and it builds on the contact-graph model in
[13-contact-graph-and-notification](13-contact-graph-and-notification.md) and the
in-person flow in [25-in-person-connect](25-in-person-connect.md).

## The jobs the app does

Everything the product needs reduces to a short list. If a surface is not one of
these, it is not a tab:

1. **Carry your status** - the badge card, and knowing where you stand to keep it
   blue (see [the home card](#home)).
2. **Share a link, and view the ones you have** - your public profile and any
   private links, in one place.
3. **Scan, and be scanned** - meet someone in person and connect in one gesture.
4. **Groups** - the people you are meeting for an event, at a glance, by status
   color. Being in the group is the sharing.
5. **Starred people** - the few you keep close, pinned to the top.
6. **Find care** - testing, PrEP, condoms, PEP, and the trustworthy links.
7. **Notifications** - the quiet inbox.
8. **Your account** - settings, sign out, delete everything.

The guiding cut: **no mode pickers, no per-person dials, no aggregate verdicts.**
Anywhere a feature asks the owner to configure who sees what beyond "public profile
or private link," it is a candidate for removal. The privacy model already does the
hard part; the UI should not re-expose it as knobs.

## Navigation

The bottom bar (sidebar on desktop) is a small, stable set, each item a job above:

- **Home** - your card and where you stand.
- **Links** - share and manage your links (the share flow and the live-links list,
  which used to be buried in Privacy).
- **People** - your connections, starred at the top, and your groups. Scanning to
  connect starts here.
- **Care** - find testing and the trust links.

Notifications is a quiet bell, not a tab. The one account screen is reached from Home
or a name chip, not the bar.

This is the shipped shape: Home / Links / People / Care. There is no Connect or Circles
destination; scanning and groups live under **People**, and **Links** has a first-class
home of its own instead of living inside Privacy. What is still pending is the account
screen's rename from **Privacy** to **Settings** (it still carries the Privacy name in
code, see [Settings](#settings) and the copy-rework list at the end).

## Identity: faces are the privacy engine

Handles are no longer a side feature; they are the core of how privacy works now, so
they need one coherent model used the same way on every surface. The mechanism lives
in [15-per-alias-identity](15-per-alias-identity.md); this is the product shape over it.

**One private name, never shared.** The owner has a single **name they chose for us to
call them by** (the sign-up display name). It is local: it powers the greeting and is
the fallback for a connection's private label, and it is never sent to anyone. The
owner has **no avatar**; the person has a name, not a face.

**Every time you share, you pick a face.** A "face" is how you appear on one shared
thing (a public profile, a private link, a group). It is one of two kinds:

- **You** - your main identity (a name you choose to show plus an avatar), recognizable
  on purpose.
- **A fresh anonymous face** - a minted handle (@invisible_otter_35) and an id-derived
  avatar, unlinkable from you and from your other anonymous faces.

The control is **identical everywhere you share** - same words ("show as: a new
anonymous handle, or you"), same default (anonymous), same place (in the share or join
step, never a separate "set up a handle first" detour). The share sheet already works
this way; the proposal is that the public-profile claim and the group-join use the
exact same control and language, so it is one concept learned once.

**A readable name rides on top of the handle, and both sides have a say.** The handle
(@invisible_otter_35) is always the technical fallback, but it is opaque, so:

- The **sharer** may **optionally attach a name** to a face (default off). It can be
  their real name or a one-off nickname, and attaching it does not break unlinkability:
  the handle underneath can still be a fresh anonymous one, so a name is about
  *readability*, while the face choice above is about *linkability*. The two compose:
  "anonymous handle, no name" and "anonymous handle, called Sam for this one person"
  and "my main identity" are all reachable.
- The **receiver** may **rename** the contact locally at any time, an override only
  they see, never sent.

So the name shown for a contact resolves in order: **the receiver's rename, else the
name the sharer chose to share, else the handle.** This is the same mechanism as the
connection rename in People, seen from the identity side.

**Where faces are managed.**

- **Creation is in-context.** You choose the face at the moment you make the link or
  join the group. There is no global "create a handle" screen, because a handle only
  means something attached to a thing you are sharing.
- **A "your handles" list in Settings is for review and cleanup, not creation.** It
  shows each active face and the one thing it is attached to, and lets you retire one.
  It must not nudge reuse, because reusing a face across two contexts is exactly what
  links them.
- **The public name is the single exception** - the one openly-listed, opt-in,
  inherently-linkable identifier (that is its job). It is claimed and released in
  Settings. Everything else defaults to unlinkable.

**Consistency rules that keep it intuitive:** same control and default on every share
surface; avatars are always per-face, never per-person (matching "no owner avatar");
the private name is never a face and never leaves the device. The open question worth
resolving before building is whether an anonymous face is **fresh per connection**
(maximally unlinkable, but a person who reconnects to you cannot recognize you) or
**stable per person** (recognizable to that one person, linkable only if they collude),
which is the doc 18 decorrelation tradeoff applied to 1:1 links.

## Getting in: sign in and sign up

The way back into an account, and the way to make one, are governed by the factor model in
[32-account-recovery-and-unlock](32-account-recovery-and-unlock.md) (the root key, wrapped
by a passkey, a recovery phrase, and an optional password). This section owns the **shape**
of those two screens.

**Sign in leads with the passkey.** The primary action is "log in with passkey," because it
is the recommended path: nothing to type, and it cannot be phished. The other two ways in
sit behind an **"other ways to log in"** disclosure rather than stacked as three equal
cards, so the common case is one obvious button. Expanding the disclosure offers a choice:

- **@handle and password** - the person's public handle plus their password (doc 32). This
  is the memorable, weaker, opt-in path.
- **Recovery phrase** - the high-entropy backstop, for anyone who has neither a passkey nor
  a password on this device.

The **"keep me signed in on this device"** toggle (doc 24) stays always visible, not hidden
in the disclosure, because it is a choice every sign-in makes. Switching between **log in**
and **sign up** is easy and obvious, one tap either way; a person who opened the wrong one
should not have to hunt.

**Sign up is simplified.** It collects only what a new account needs, and it is honest
without preaching:

- **No avatar step.** An avatar belongs to a handle, not to the account (see Identity: the
  owner has no avatar). The onboarding avatar builder is dropped.
- **"What should we call you?"** is the display-name step: a single labeled field with a
  dice / shuffle button that fills a short, playful name the person can keep or edit. It is
  the private name from Identity above, never shared.
- **A choice of how to get back in, with the passkey as the default.** The recommended,
  one-tap path is a passkey (biometrics), which needs no handle; a person can stop there.
  Choosing a **password** instead (or as well) means **also picking a public handle** as its
  login name (doc 17), so "@handle plus password" is set together, the common case being a
  person who wants that familiar pairing. Whatever they pick, sign-up **always still shows
  the recovery phrase** as the ultimate backup. Because the freshly generated root is in
  memory at sign-up, choosing a password here needs **no recovery-phrase re-entry** (that
  friction only exists when adding a password later, doc 32).
- **Guide toward the stronger choice, hold a floor under every path.** The flow nudges
  toward the passkey (phishing-resistant, the default) and frames the password as the weaker
  opt-in, but it does not lecture or block. The guidance is soft; the quality floors are not:
  a real password-strength gate (reject weak, not merely score it), and the recovery phrase
  generated no matter what. Good defaults and honest nudges, with a safety floor that does
  not bend.
- **No "account key" explainer.** The old preachy, not-fully-true account-key screen is
  dropped; the recovery phrase is shown plainly as the backup, without a lecture.
- **A clear "Back" affordance, and a step indicator that is not the back label.** The step
  indicator must read as progress, not as the back button, so the two are never confused.
- **The honest public-name note stays.** Choosing @handle plus password means claiming a
  public name people can find you by, so that disclosure (doc 17) rides with the choice.

## Home

The honesty principle from [03-design](03-design.md) holds: the owner must never
drift between "what I think I share" and "what others resolve." But Home does not
need to sit a passive copy of the viewer card on the screen as decoration. Instead,
Home leads with one card that **toggles between two clearly-labeled views of the
same status**:

- **Your criteria** - the owner-only breakdown: the three things blue needs, where
  you stand on each, when to re-test, and a way straight to testing. This is the
  default the owner lands on, so opening Home answers "where am I" first.
- **What others see** - the badge exactly as a viewer resolves it, one tap away so
  the honest mirror is never more than a tap off.

Which view opens by default is a **Settings** preference (defaulting to "your
criteria"); the toggle still switches freely after open. The toggle replaces the
earlier "blur and reveal" treatment. A labeled switch makes it unambiguous which
view is shared and which is private to you, where a blur only hid the detail without
naming it. The badge itself never gains tiers, meters, or streaks.

## Links

One screen for every link you hand out:

- **Your public profile** - the durable "anyone who scans sees my status" link and
  its QR. It stays live until you revoke it; it never carries an expiry (a public
  link that silently lapses is a trap). Taking it down is a revoke, or releasing its
  public name, never a timer. Sharing it **as yourself**, once you hold a public name,
  hands out the recognizable `/u/{name}` link rather than an opaque `/a/{id}`; sharing
  it **anonymously** hands out the opaque link. The named link is the findable one
  (doc 17): it resolves by name and the viewer still asks before they see your status,
  so the share surface labels it plainly instead of borrowing the "anyone who scans
  sees this status" line.
- **Private links** - one-off links you send to one person. These *can* expire (an
  hour to a month, or until revoked), because a one-off link sensibly lapses.
- Each link shows its real URL and a scannable QR that reflect the actual link, with
  copy and save. While a link is being prepared, the screen says so plainly rather
  than showing a stand-in.

Expiry is therefore a **private-link-only** affordance. This is the rule the recent
share-sheet and publish-layer changes already enforce; this doc records it as the
design, not just the code.

**Preview lives inside sharing, not beside it.** "See what others see" is not a
separate destination; it is what the share surface already shows (the card preview at
the top of the share sheet is the viewer's-eye view). So there is no standalone
"Preview" action competing with "Share my passport"; opening the share surface *is*
the preview, and sending is one tap from it.

**Naming a public profile is checked as you type.** Claiming a public name validates
the format immediately and checks availability while you type (debounced), so you
learn a name is free before you commit, not after you submit. When a name can't be
had, the reason is not always "taken" (it may be reserved or blocked), so the message
says it plainly: "That name isn't available. Try another."

## People

Your connections, on-device only, never a searchable directory (the no-directory
stance in [13-contact-graph-and-notification](13-contact-graph-and-notification.md)
holds). Three things live here:

- **Starred** at the top - the few you pin. No new mechanism; today's faves, given
  the prime spot.
- **Groups** in the middle - see below.
- **Recent connections** at the bottom - everyone you have linked with, newest
  first, below the starred and the groups (the people you actively reach for sit up
  top; the long tail sits under them). They stay on your device until you delete
  them; nothing prunes them automatically (each holds the capability that later lets
  a positive report quietly reach past partners, so we do not throw them away on a
  timer). The old "removed after 90 days" line was never true and is gone.

  You can **rename** any connection to whatever you want - a local label only you ever
  see, never sent - because an opaque handle like @invisible_otter_35 is useless for
  remembering who someone is. The person you connect with can also **optionally share
  a name** for you (default off). If they do, you receive it once as the starting value
  of that label: a copy you own from then on, editable anytime, that never changes on
  its own. The handle underneath stays live and keeps following whatever they set, but
  a shared name is a snapshot, not a feed - unlike the handle, it does not auto-update.
  So the name you see for a contact is **your label if you have set or received one,
  else the live handle.** This replaces the earlier "private label" idea: the shared
  name and your rename are the same editable label, just seeded differently.

Connecting is by **shared link or scan only**, member-initiated, two-way. There is no
handle search and no way to be looked up.

## Scan, and be scanned

Today the app can scan a code but cannot *show* one to be scanned. Finish the
symmetric gesture from [25-in-person-connect](25-in-person-connect.md): one screen
shows your code and runs the scanner at once, both people point cameras, the first
read completes the two-way link silently. No "show vs scan" mode toggle, no role
choice. It works fully offline (the card bytes can cross in the QR), which makes it
the more private path, not a degraded one.

## Groups

This is the biggest simplification, and the one most worth getting right.

**The whole idea:** a group is the people you are meeting, and being in the group *is*
the sharing. It is the shortcut for wiring up many status views at once instead of one
pairwise link at a time. The people in it see each other's status as a row of color
(blue or gray), and that is the feature. You choose the face you appear under (your
main identity or a fresh handle), so a group never forces your main identity, but you
do appear, visibly, as a member. The full model (the group handle, the roles, the
join/leave lifecycle, the crypto, and the notify rule) lives in
[33-shared-groups](33-shared-groups.md); this section is just how it feels.

What that means concretely:

- **Membership is the sharing, and everyone in the group sees everyone.** There are no
  per-member visibility dials and no "anonymous presence" mode: if you are in the
  group, your current color shows to every member, and you see theirs. Joining is that
  one consent. Getting in is a two-sided act though (doc 33): an admin invites you and
  you accept, or you find a public group and request in and an admin accepts. If you
  do not want to share with the group any more, you leave.
- **The group has one handle, public or private.** A public group is discoverable and
  can be requested to join (like a findable name, doc 17); a private group is
  invite-only. The handle names the group and carries no status.
- **A calm roster, never a verdict.** The group shows each member as a status dot,
  newest or starred first. It does **not** compute a room rollup, print counts
  ("7 ready, 2 not shared"), or render a door/check-in "the room is ready" screen.
  Those exclusion-coded surfaces are out (this agrees with the Circles target already
  in [07-screen-by-screen-build-guide](07-screen-by-screen-build-guide.md) §F). The
  event view is a quiet glance at colors, not a bouncer.
- **No minimum group size.** Earlier circles hid statuses until a group had ~5
  members, to stop a tiny roster from outing one person. That floor made sense only
  in the old model where being listed was not itself an explicit act of sharing. Here
  it is: joining a group *is* consenting to show your color to its members, so there
  is nothing to protect with a headcount, and "why do I care how many people are in
  the group" is the right instinct. A two-person group is fine; both chose to share.
  The full roster is visible to its members (there are no hidden members), so there is
  also no "others you cannot see" notice to carry.
- **Leaving and being removed look identical** to everyone else, with no mark and no
  reason shown. The person affected can tell their own access ended; no one else can.

The "permanent circle" and "event group" distinction collapses: there is one kind of
group. If you want it for one night, you make it and delete it after; deletion drops
the grouping only and never touches the underlying connections. This folds together
what [07-screen-by-screen-build-guide](07-screen-by-screen-build-guide.md) §F split
across "Circles" and "Events," and supersedes the "set a tested-within-N-days bar"
entry threshold (removed).

## Care

Largely as-is: free and low-cost testing, PrEP, condoms, and time-critical PEP
finders, plus the trustworthy links and "talk to someone." It is the one place that
routes outward to real-world help, and it should stay calm and practical, never a
nag. No change of substance proposed here beyond keeping it the single home for
where-to-go.

## Notifications

The quiet, contentless inbox, unchanged in principle: a re-test nudge, a request to
see your status, the partner-notify prompt. It never names a person or a condition.
It stays a bell, not a tab.

## Settings

"Privacy" as a destination becomes **Settings**: the privacy model is not a screen
you operate, it is how the product works, so it does not need a control panel named
after it. The one place the owner manages their account holds:

- **The few real toggles** - sharing default, push notifications, pause sharing,
  install the app. The HIV-protection and condom attributes that feed the badge live
  with the result you report, not here.
- **Your name** - the name we call you by, editable here.
- **Sign out** - plainly available, not hunted for. (It is not even wired into the
  running app today; it should be.)
- **Delete everything** - the existing real delete (revoke every link, remove the
  encrypted blob, sign out), with its confirm, in the one place a person looks for it.

A short "how this stays private" explainer can live here too, but as a plain read,
not a wall of toggles. This replaces the monolithic Privacy screen that today mixes
the account actions, the attributes, the links list, and the explainer.

## What this supersedes or folds in

- **[07-screen-by-screen-build-guide](07-screen-by-screen-build-guide.md):** the
  shipped Home / Links / People / Care bar replaces the implicit `home / connect /
  circles / care` shape that guide assumed; §E (Connect) and §F (Circles & Events)
  folded into **People** and **Groups** above. The cross-cutting cleanups in §G
  (handles not names, blue/gray everywhere, no self-reported stamp, no streak) are
  unchanged and still apply.
- **[13-contact-graph-and-notification](13-contact-graph-and-notification.md):** the
  contact and group data model and the partner-notify pipeline are unchanged; this
  doc only simplifies how they are surfaced.
- **[25-in-person-connect](25-in-person-connect.md):** unchanged design; this doc
  commits to building the missing "be scanned" half so the gesture is symmetric.

## Group roster identity: the handle you joined with

You appear in a group under **the handle you joined with** - your main identity, or an
anonymous handle you mint for the occasion. One handle per group, so the roster is
coherent: everyone there sees the same dot for you. Being in the group **is** sharing
your ring color (blue / gray) with everyone in it. Because blue/gray carries so little
information, that exposure is acceptable, and it keeps the model simple: no per-member
visibility dials, no auto-minted per-group identity to manage. Getting in is a two-sided
act (an admin invites and you accept, or you request a public group and an admin
accepts) and how the roster changes over time is owned by [33-shared-groups](33-shared-groups.md);
this section is only about the face you wear and what joining discloses.

The consent is joining, and a group's membership can grow as admins invite more people
(each of whom accepts). Two things must be plain at join time so that is an informed
choice, not a surprise:

- **Join-time honesty.** The join screen says plainly that everyone in the group sees
  your color, that **if anyone in the group later reports a positive, everyone in it is
  told to get tested** (the notify rule, doc 33), and that **leaving is one tap and
  always available.**
- **A fresh anonymous handle is the easy default.** Joining offers "join as a new
  anonymous handle" up front, so a person who wants this group uncorrelated from their
  other presence gets that with one tap. Reusing one handle across groups is allowed,
  but it is a choice the person makes, not an accident the product imposes. Cross-group
  decorrelation is therefore available (see
  [18-sibling-alias-decorrelation](18-sibling-alias-decorrelation.md)) without being
  forced on everyone.

There is no minimum group size and no hidden-members notice: joining is itself the act
of sharing your color to the group, so a headcount protects nothing (see Groups). The
context caveat is the real one to respect: a color in a group named for a specific
place or event carries more than a color alone, so group names should not be forced to
be descriptive.

## Open questions (do not block; resolve before building)

- **Owner avatar removal scope:** the onboarding avatar step is dropped (see Getting in:
  sign in and sign up). What is still open is the edit screen: remove the owner-avatar edit
  entirely, or just stop showing an owner avatar while the per-link avatar picker stays? The
  latter is far less invasive.
- **Links tab vs. Settings overlap:** the "sharing default" toggle could live in
  either; proposed home is Settings, with Links showing the result.
- **Sequencing:** the Settings section, the "be scanned" half, and the Home toggle
  are self-contained; the Groups consolidation and the nav change are larger and
  follow once this shape is signed off.

## Copy that reworks with each build

User-facing strings that are accurate to today's code but describe the old model, so
they change **as part of building each feature** (rewording them earlier would make the
copy contradict the screen that is still there). Tracked here so none is forgotten:

- **Avatar removal:** `onboarding/claimCopy.ts` ("Your face", "this is your avatar",
  the `anonNote` about your avatar appearing on a link), `onboarding/AvatarBuilder.tsx`
  alt text, and `core/Privacy.parts.tsx` ("Your avatar" / "Edit"). Reframe to per-share
  faces (anonymous by default, or show your name); the owner has no avatar.
- **Privacy to Settings:** the `PRIVACY_SCREEN_NAME` constant and the screen title /
  nav label.
- **Recovery + optional password:** the recovery copy stays phrase-only until the
  password login ships, then gains an honest "a convenient, weaker way back in, not the
  equal of the phrase or a passkey" line (never overclaiming), plus the note that a
  password means claiming a public name people can find you by (doc 17). The password's
  login name is a public handle, not a separate recovery name (doc 32).

Already corrected (copy that was wrong against shipped behaviour): the contact-prune
line, the name-availability message, the share-sheet identity warning, and the groups
copy (the circle screens now read as one kind of group, membership is the sharing, and
the 5-person hide floor is gone; the screen files keep their `circle` names until the
mechanical rename). Two surfaces
to re-verify directly when next touched: the rendered privacy-policy page (the doc 23
spec had a wrong expiry line) and the privacy promises list (no promise should assert
link expiry or findability in a way the new model changes).
