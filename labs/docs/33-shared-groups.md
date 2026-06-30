# 33 - Shared groups (the technical model)

## Status: PROPOSED (design); first draft for discussion, do not build until signed off

[31-app-shape](31-app-shape.md) locks what a group _is_ and how it _feels_: being in
the group is the sharing, admins can add members, you appear under a handle you joined
with (anonymous by default), the roster is a calm row of color, there is no minimum
size, and leaving and being removed look identical to everyone else. This doc owns the
part doc 31 does not: **how a shared, multi-party group actually works without the
server learning the group, its members, or anyone's status.** It builds on the contact
model in [13-contact-graph-and-notification](13-contact-graph-and-notification.md) and
keeps the blind-store boundary in [10-build-backend-and-deployment](10-build-backend-and-deployment.md)
intact.

## The gap between today and the goal

**Today a "group" is local and one-sided.** The record is just `{ id, name,
memberContactIds }`: a private bundle of contacts the owner already linked with
pairwise. The roster works by resolving each member's _existing pairwise status
alias_ (the one they shared with the owner). So today's group is a saved view over the
owner's own pairwise links; no one else knows the group exists, and two members who
never pairwise-linked cannot see each other.

**The goal is a shared group.** "Admins can add members after you joined, and they see
your color too" (doc 31) means a member B, added by an admin, must see member C's
status even though B and C never pairwise-linked. That capability does not exist today,
and it is the whole technical problem: **group membership has to grant status
visibility among members who never linked one-to-one,** and it has to do so without the
server learning the membership graph or any status.

## The model: a shared group read key, per-member group cards

A group is a **shared symmetric key** plus a roster. Every member publishes a
**group-scoped status card** encrypted under the group key, and every member holds the
group key, so any member can read any member's group card. The server only ever sees
opaque ciphertext at opaque ids, exactly like a pairwise alias.

- **Group key (`Kg`).** A random symmetric key minted when the group is created. It is
  the capability to read the group: hold it and you can decrypt every member's group
  card; lack it and the group's rows are uniform noise. It is never sent to the server.
- **Per-member group alias.** Each member mints one alias _for this group_ and PUTs
  their current card there, sealed under `Kg` (not under a per-member key). Its id is
  random and unlinkable to the member's other aliases (decorrelation, doc 13). The
  member republishes it when their badge changes, exactly like any other alias.
- **The roster** is the list of those per-member group-alias ids. Holding `Kg` + the
  roster, a member resolves every row: fetch each id, open with `Kg`, read the color +
  the join-time handle. The server sees a set of reads against unrelated ids, never a
  "group."
- **The group object itself** (name, roster, the wrapped `Kg` for each member) lives in
  each member's own account blob, and/or in a server-stored **group blob** that is
  itself ciphertext (see "Where the group lives"). The server stores bytes and routes
  reads; it never holds `Kg` and never learns who is in what.

This mirrors patterns the app already has: a card sealed to a key and PUT to an opaque
id (publish.ts), and a key wrapped per-recipient (the passkey/recovery envelopes, doc
24 / doc 32). A group is "one card key shared by N people" instead of "one key per
pairwise edge."

## Joining, and the handle you joined with

When you join (you create the group, or an admin adds you), you:

1. Receive `Kg` and the current roster (handed to you in the invite/add, below).
2. Pick the **face you join under** (doc 31): your main identity, or a fresh anonymous
   handle minted for this group. This is the one-tap default-anonymous choice doc 31
   describes; it is bound into your group card (the handle + avatar the other members
   see), and it is per-group, so the same person can be `you` in one group and an
   anonymous handle in another, uncorrelated.
3. Mint your per-member group alias, seal your current card (color + chosen handle)
   under `Kg`, PUT it, and add its id to the roster.

Honesty at join time (doc 31): the join step states plainly that joining shows your
color to everyone in the group, including people an admin adds later. One decision, no
per-member dials.

## Admin-adds-a-member (the new capability)

"Admins can add members after the group is made" (doc 31). An admin adding member M:

1. Hands M the group key `Kg` and the current roster, the same bundle a creator gets.
   This is an **invite capability** (like a contact invite, doc 13): it can ride a
   link, a QR, or a per-contact channel the admin already has to M. The server is not
   asked "add M to group G"; the admin gives M what M needs to participate.
2. M joins (mints their group alias under `Kg`, picks a join handle, publishes, appends
   their id to the roster).
3. The roster update propagates so existing members see M's row (see "Where the group
   lives" for how a roster change reaches everyone without the server understanding it).

Who may add: doc 31 says "admins." The minimal model is **the creator is the admin**
(and may designate others); admin status is a roster flag. A non-admin member can leave
but not add. (Open question below: do we need multiple admins for v1, or is
creator-only enough?)

## Removal and leaving: "no future reads," indistinguishable

Doc 31: leaving and being removed look identical, with no mark or reason; the affected
person can tell their own access ended, no one else can. And revoke means "no future
reads," not "unsee" (doc 01).

- **Leaving** drops your group alias (revoke it: overwrite to garbage, like any link)
  and removes your id from the roster. Your past color was already seen; that is fine.
- **Removal by an admin** must end the removed member's _future_ reads of the group.
  Because every member holds `Kg`, removing one member means the key they hold can no
  longer open new cards: so removal **rotates the group key**. The admin mints `Kg'`,
  re-wraps it to every _remaining_ member, and every remaining member republishes their
  group card under `Kg'`. The removed member keeps `Kg` (you cannot un-give a key) but
  it opens nothing new: all live cards are now under `Kg'`. This is the standard
  "remove = rotate" and it is the honest meaning of removal here.
- Indistinguishability: to the rest of the roster, a removed id and a left id both just
  vanish from the roster with no annotation. The removed person sees their reads return
  uniform noise (the same as a group that was deleted), and is told their access ended,
  without a reason.

Key rotation is the load-bearing, fiddly part (a member offline during rotation, a
race between two admins, the cost of N members republishing); it is called out as a
primary corner case below.

## Where the group lives (server's view)

Two candidate storage shapes, to choose in discussion:

- **(A) Group blob, server-stored, member-readable.** The group's shared state (name,
  roster of member-alias ids, the per-member wrapped `Kg`) is a single ciphertext blob
  at an opaque group id, sealed so only members (holding `Kg` or a roster key) can read
  it. Members poll it for roster/key changes. The server stores one more opaque blob
  and routes reads; it learns a blob exists and is read by some clients, never its
  contents or who. This is the cleanest for propagation (admin writes the blob, members
  read it), at the cost of one shared mutable object and its write-authorization story.
- **(B) No group blob; the roster rides the invite/notify channels.** The group exists
  only as each member's local copy of `{ Kg, roster }`; roster/key changes are pushed
  over the per-member channels the admin already holds (the same way a contact invite
  reaches one person). No shared server object, but propagation is N messages and
  membership state can diverge between members until they sync.

(A) is likely simpler to reason about and matches "admin updates the group, members
see it"; (B) keeps the server even blinder. This is an explicit open question.

Either way the invariants hold: the server never holds `Kg`, never sees a card's
plaintext, and the group/membership is not a graph it can read. Group reads are
rate-limited and existence-uniform like alias reads, so a group id is not an oracle.

## What stays unchanged

- The blind store: only ciphertext + opaque routing. No new plaintext, no membership
  graph, no status visible to the server.
- Pairwise contacts (doc 13) are untouched; a group is a separate overlay, and deleting
  a group never affects the underlying connections (doc 31).
- The calm roster, no-rollup, no-counts, no-verdict UI (doc 31) is unchanged; this doc
  only supplies the bytes behind those color dots.
- Decorrelation: a member's group alias is unlinkable to their other aliases, and their
  per-group handle is independent across groups, so being in two groups does not
  correlate the two memberships to one person.

## Corner cases (the part to get right)

- **Key rotation on removal:** an offline member misses `Kg'` and must catch up on next
  sync (their own card stays under old `Kg` until they republish; meanwhile others
  cannot read it, so they show as gray/absent, which is acceptable and not a leak).
  Concurrent removals by two admins must converge on one `Kg'` (last-writer or a
  version counter on the group blob).
- **Admin leaves / sole admin removed:** the group must not become unadministerable.
  Define succession (creator-only is simplest; if multiple admins, removal of one
  leaves the others).
- **Adding a hostile member:** mitigated by doc 31's model, not crypto: joining is
  consent, the roster is fully visible (no hidden members), and anyone can leave. An
  admin adding someone you dislike is a social problem with a one-tap exit, not a
  visibility leak.
- **A member who never republishes:** their group card is stale or absent; the roster
  shows them gray, never a wrong color. No card is ever shown under a key that cannot
  open it.
- **Scale:** N members means N reads per roster refresh and N republishes per rotation.
  Fine for event-sized groups; note a soft cap and that this is not built for thousands.
- **Notify within a group:** out of scope for v1 unless we want "a member reported a
  positive" to ping the group; doc 13's per-contact notify does not automatically cover
  group members. Flag as a follow-up, not a launch requirement.

## Open questions (resolve in discussion before building)

- **Storage shape:** group blob (A) vs channel-only roster (B) above.
- **Admin model:** creator-only admin for v1, or multiple admins + succession now?
- **Rotation cost:** is "remove = rotate + everyone republishes" acceptable at the
  group sizes we target, or do we want a cheaper scheme (e.g. per-epoch keys) later?
- **Migration:** today's local `CircleRecord` (a name + member-contact-ids) is a
  private view, not a shared group. Do existing local groups become shared groups, or
  do shared groups ship as a new thing alongside (and the local view stays as "a saved
  filter over my contacts")? Leaning: shared groups are the new model; decide whether
  to auto-migrate or keep both.
- **Group notify:** ship without group-level notify (v1), add later if wanted.

## Implementation plan (slices; do not start until signed off)

1. **Crypto: group card + key wrap.** Seal/open a card under a shared `Kg`, and
   wrap/unwrap `Kg` per member (mirrors publish.ts + the envelope wraps). Pure,
   unit-tested.
2. **Group object + roster.** The chosen storage shape (A or B), with create / read /
   roster-append, within the blind-store boundary. Server tests if (A).
3. **Join + per-group handle.** Mint the group alias, pick the join face (anonymous
   default), publish the group card; the roster resolver reads every row.
4. **Admin-add + invite capability.** Hand `Kg` + roster to a new member over an invite
   channel; they join; the roster propagates.
5. **Remove + key rotation.** Mint `Kg'`, re-wrap to remaining members, everyone
   republishes; removed reads go uniform; leave/remove indistinguishable.
6. **UI (doc 31).** The roster of color dots, join honesty, admin-add control, leave;
   no rollup/counts/verdict. Wire into the People surface per the nav plan.
7. **Follow-ups:** group notify, multi-admin succession, rotation-cost optimization, if
   wanted.
