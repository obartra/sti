# 31 - App shape and simplification

## Status: PROPOSED (design)

The app does more than it needs to. This doc fixes the shape: the handful of jobs
the product actually does, the navigation that exposes them, and the simplifications
that get us there. It is the owner for the app's top-level information architecture.
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

## Target navigation

A small, stable bottom bar (sidebar on desktop), each item a job above:

- **Home** - your card and where you stand.
- **Links** - share and manage your links (absorbs today's share flow and the
  "live links" list now buried in Privacy).
- **People** - your connections, starred at the top, and your groups. Scanning to
  connect starts here.
- **Care** - find testing and the trust links.

Notifications stays a quiet bell, not a tab. **Settings** (which absorbs today's
Privacy screen) is reached from Home or a name chip, not the bar.

This replaces today's `home / connect / circles / care` bar: Connect and Circles
merge into **People**, **Links** gets a first-class home instead of living inside
Privacy, and Privacy becomes **Settings**.

## Identity: a name, and link faces

The owner is just **a name they chose for us to call them by** - the local display
name from sign-up. There is no owner avatar and no owner profile picture: the person
does not have a face in the product, only a name. Faces belong to **links**, not to
people. A public profile or a private link can carry its own avatar (the per-link
identity in [15-per-alias-identity](15-per-alias-identity.md)), so what a viewer sees
is the face the owner chose *for that link*, anonymous by default. This keeps the one
identifiable thing (the name) minimal and puts every visual identity where it is
actually shared and controlled: on the link.

## Home

The honesty principle from [03-design](03-design.md) holds: the owner must never
drift between "what I think I share" and "what others resolve." But Home does not
need to sit a passive copy of the viewer card on the screen as decoration. Instead,
Home leads with one card that **toggles between two clearly-labeled views of the
same status**:

- **What others see** - the badge exactly as a viewer resolves it. This is the
  default, so the honest mirror is the first thing you land on.
- **Your criteria** - the owner-only breakdown: the three things blue needs, where
  you stand on each, when to re-test, and a way straight to testing.

The toggle replaces the earlier "blur and reveal" treatment. A labeled switch
("what others see" vs "your criteria") makes it unambiguous which view is shared and
which is private to you, where a blur only hid the detail without naming it. The
badge itself never gains tiers, meters, or streaks.

## Links

One screen for every link you hand out:

- **Your public profile** - the durable "anyone who scans sees my status" link and
  its QR. It stays live until you revoke it; it never carries an expiry (a public
  link that silently lapses is a trap). Taking it down is a revoke, or releasing its
  public name, never a timer.
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
- **Recent connections** - everyone you have linked with, newest first. They stay on
  your device until you delete them; nothing prunes them automatically (each holds
  the capability that later lets a positive report quietly reach past partners, so we
  do not throw them away on a timer). The old "removed after 90 days" line was never
  true and is gone.
- **Groups** - see below.

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

**The whole idea:** a group is the people you are meeting for an event, and being in
the group *is* the sharing. You make a group, the people in it see each other's
status as a row of color (blue or gray), and that is the feature. You can mint an
anonymous handle to appear under, so a group never forces your main identity.

What that means concretely:

- **Membership is the consent.** There are no per-member visibility settings, no
  "anonymous presence" mode, no per-group dials. If you are in the group, your
  current status color shows to the group; if you do not want that, you leave. One
  decision, not a settings page. (Most of this complexity was feared, not built - the
  current group record is just a name and a member list - so this is mostly *not
  adding* it, and removing the conceptual surface area from the plan.)
- **A calm roster, never a verdict.** The group shows each member as a status dot,
  newest or starred first. It does **not** compute a room rollup, print counts
  ("7 ready, 2 not shared"), or render a door/check-in "the room is ready" screen.
  Those exclusion-coded surfaces are out (this agrees with the Circles target already
  in [07-screen-by-screen-build-guide](07-screen-by-screen-build-guide.md) §F). The
  event view is a quiet glance at colors, not a bouncer.
- **A privacy floor stays.** A group still hides every status until it has at least a
  few members (the existing minimum, ~5), so a tiny group never turns one gray dot
  into a guess about one person. Every roster also carries the standing "there may be
  others here you cannot see" note, so absence is never readable as exclusion.
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
  top-level navigation here replaces the implicit `home / connect / circles / care`
  shape; §E (Connect) and §F (Circles & Events) fold into **People** and **Groups**
  above. The cross-cutting cleanups in §G (handles not names, blue/gray everywhere,
  no self-reported stamp, no streak) are unchanged and still apply.
- **[13-contact-graph-and-notification](13-contact-graph-and-notification.md):** the
  contact and group data model and the partner-notify pipeline are unchanged; this
  doc only simplifies how they are surfaced.
- **[25-in-person-connect](25-in-person-connect.md):** unchanged design; this doc
  commits to building the missing "be scanned" half so the gesture is symmetric.

## Open questions (do not block; resolve before building)

- **Group roster identity:** when you appear in a group under an anonymous handle, is
  it one stable anonymous handle per group, or per-person-per-group? Per-group keeps
  groups from being cross-linkable; confirm against
  [18-sibling-alias-decorrelation](18-sibling-alias-decorrelation.md).
- **Links tab vs. Account settings overlap:** the "sharing default" toggle could live
  in either; proposed home is Account, with Links showing the result.
- **Sequencing:** Account section and the "be scanned" half are self-contained and
  can ship first; the Groups consolidation and the nav change are larger and should
  follow once this shape is signed off.
