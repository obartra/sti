# 33 - Shared groups (the model)

## Status: PROPOSED (design); the shape below is agreed, the two crypto open questions at the end are for discussion before build

A group is one shared thing many people are in, used to **set up a whole network of
status-sharing at once** instead of one pairwise link at a time. This doc owns what a
group is, who can do what, what everyone can see, and how it works without the server
learning the group, its members, or anyone's status. It supersedes the group section
of [31-app-shape](31-app-shape.md) (which sketched a lighter, local-only group) and
builds on the contact and notify model in
[13-contact-graph-and-notification](13-contact-graph-and-notification.md) and the
blind store in [10-build-backend-and-deployment](10-build-backend-and-deployment.md).

## One kind of group

There is a single concept of group. Not "circles" vs "events", not local vs shared:
one thing.

- **A group has one handle, either public or private.** The handle names the group
  (like a person's handle names them). **Public**: the group is discoverable and can
  be found and requested to join, the way a findable name is (doc 17). **Private**:
  the group is invite-only, reachable only through an invite an admin sends. The
  handle is chosen at creation and is the group's address; it carries no status.
- **Everything inside a group is fully visible to its members.** Every member sees
  every other member and every member's current status color. There is no
  anonymous-within-the-group mode and no per-member visibility dial: being in the
  group is sharing your color with the group, and seeing the group is seeing
  everyone's. You still choose the face you appear under (your main identity or a
  fresh handle, doc 31), but you appear, visibly, as a member.
- **Membership is the sharing.** The group is a shortcut for building many pairwise
  status views at once: joining a group of ten is consenting to show your color to
  those ten and to see theirs, in one act instead of ten.

## Roles and the membership lifecycle

Two roles. The creator is the first admin; **for v1 the creator is the only admin**
(designating more admins, and admin succession, is a later question).

- **Admins can:** invite people, revoke an invite before it is accepted, and remove a
  member.
- **Members can:** request to join (a public group), accept or reject an invite, and
  leave at any time.

So there are two ways in, and both are consented on both sides:

- **Invite (admin-initiated).** An admin invites someone; that person accepts or
  rejects. An unaccepted invite can be revoked by an admin.
- **Request (member-initiated).** Someone finds a public group and requests to join;
  an admin accepts or rejects the request.

And two ways out, which look the same to everyone else:

- **Leave (self).** A member leaves whenever they want.
- **Remove (admin).** An admin removes a member.

Leaving and being removed are indistinguishable to the rest of the group: the person
is simply no longer in the roster, with no mark and no reason shown. The affected
person can tell their own access ended (doc 31); no one else learns which of the two
it was. What everyone _does_ see, because membership is fully visible, is that the
roster changed.

## What the group is used for: setup, and one honest notify rule

A group does two jobs, and only these two:

1. **It sets up the network.** Joining wires up the mutual status views among all
   members at once. After that, seeing the group is a calm row of everyone's color.
2. **It scopes a notify when someone tests positive.** Pings are always individual
   (doc 13): the app never says "this came from the group", because that would point
   at the reporter. But a group tells the app _who plausibly shares exposure_, so when
   a member reports a positive, the app notifies **everyone the group implies was
   exposed**, as ordinary individual, contentless pings:

   - If the group is an **event** (a one-time meeting) and it met around the time in
     question, everyone who was in it is notified.
   - If the group is **recurring**, the app assumes it meets at least once every 90
     days, so everyone currently in it is notified.

   The app has no finer information than "these people were in a room together", and
   being more specific would be more revealing, so it treats the whole group as
   exposed. This must be disclosed plainly **at join time**: joining a group means _if
   anyone in it later reports a positive, everyone in it gets told to test_. That
   expectation is the point of groups, and saying it up front is the honest framing
   (doc 21), not a buried term.

## How it works without the server learning the group (the model)

The blind-store rule holds: the server stores ciphertext at opaque ids and routes
reads; it never learns the group, its members, or any status. Because members see
each other by design, the privacy boundary here is **the server and everyone outside
the group**, not member-from-member.

- **A shared group key `Kg`.** A random symmetric key minted when the group is
  created. Holding it is what lets a member read the group; the server never has it.
- **Per-member group cards.** Each member publishes their current status card for this
  group, sealed under `Kg`, at an opaque id unlinkable to their other aliases (doc
  13). They republish it when their badge changes. The roster is the set of those ids;
  holding `Kg` + the roster, any member reads every member's color and join handle.
- **The group object** (its handle, roster, wrapped `Kg` per member, admin flag) is
  itself ciphertext; the server stores bytes and routes reads, never the contents.
  Exactly where it lives is the first open question below.
- **The public handle**, when the group is public, resolves like a findable name (doc
  17): a lookup returns an opaque pointer a requester uses to ask to join; it carries
  no roster and no status. A private group has no such entry, so it cannot be found.

This mirrors patterns the app already has: a card sealed to a key and PUT to an opaque
id (publish.ts), a key wrapped per recipient (the passkey/recovery envelopes, doc 24 /
doc 32), and a name that resolves to an opaque pointer (doc 17). A group is "one card
key shared by N people" plus "a handle that points at the group".

## Removal means no future reads, so removal rotates the key

Revoke means "no future reads", never "unsee" (doc 01). Every member holds `Kg`, so
removing one member has to make the key they keep stop opening new cards:

- On a remove (or a leave), the admin mints a fresh `Kg'`, re-wraps it to every
  remaining member, and everyone republishes their group card under `Kg'`. The removed
  person keeps the old `Kg` (you cannot un-give a key), but it now opens nothing new:
  all live cards are under `Kg'`. Their past color was already seen; that is fine.

In plain terms: **kicking someone out means giving everyone still in the group a new
shared key and re-locking every card with it, so the old key the removed person holds
becomes useless.** The cost is that everyone still in the group has to re-publish once
after a removal; whether that cost is acceptable at our group sizes, or whether we want
a cheaper scheme later, is the second open question below.

## What stays unchanged

- The blind store: only ciphertext and opaque routing. No membership graph, no status,
  no group visible to the server.
- Pairwise contacts (doc 13) are untouched; a group is a separate overlay, and deleting
  a group never affects the underlying one-to-one connections.
- Decorrelation from the server and from non-members: a member's group card is
  unlinkable to their other aliases, and the group is opaque to anyone without `Kg`.
  (Decorrelation _between members_ is intentionally dropped: members see each other.)

## The two open questions (for discussion before build)

1. **Where the group object lives, without loosening our guarantees.**
   - **(A) A server-stored group blob**, sealed so only members can read it, that
     members poll for roster and key changes. Cleanest for propagation (an admin
     writes it, members read it). The server learns one more opaque blob exists and is
     read by some clients, never its contents or who. The thing to nail so we do not
     loosen guarantees: the write-authorization story (who may change the blob) and
     making its existence and reads as uniform/rate-limited as alias reads, so a group
     blob is not a new oracle.
   - **(B) No server object; the roster and key changes ride the per-member channels**
     an admin already holds. The server stays even blinder (there is no group object at
     all), at the cost of propagation being N messages and membership state drifting
     between members until they sync.

   Leaning A for its simpler propagation, but only if we can show the group blob adds
   no oracle the alias store does not already have. This is the "don't loosen our
   guarantees" call to make together.

2. **The cost of remove = rotate + everyone republishes.** Is that acceptable at the
   group sizes we target (event-sized, tens not thousands), or do we want a cheaper
   key scheme (e.g. per-epoch keys) as a later optimization? It is correct either way;
   this is only about cost.

## Corner cases

- **A member offline during a rotation** misses `Kg'` and catches up on next sync;
  until they republish, their card is under the old key and shows to others as
  gray/absent, which is acceptable and not a leak.
- **A never-republishing member** shows as gray, never a wrong color; no card is ever
  shown under a key that cannot open it.
- **Scale:** N members means N reads per roster refresh and N republishes per rotation.
  Fine for event-sized groups; note a soft cap and that this is not built for thousands.
- **Adding a hostile member** is a social problem with a one-tap exit (leave), not a
  visibility leak: the roster is fully visible and joining is consented.

## Implementation plan (slices; do not start until the two open questions are closed)

1. **Crypto:** group card seal/open under `Kg`, and wrap/unwrap `Kg` per member
   (mirrors publish.ts + the envelope wraps). Pure, unit-tested.
2. **Group object + roster** in the chosen storage shape (A or B), within the
   blind-store boundary. Server tests if (A).
3. **Create + public/private handle**: mint `Kg`, choose the handle and its visibility;
   a public handle resolves to an opaque join pointer (doc 17-style).
4. **Membership lifecycle**: invite / accept / reject / revoke, request / approve /
   reject, remove, leave. Roster propagates.
5. **Remove + key rotation**: mint `Kg'`, re-wrap to remaining, everyone republishes;
   removed reads go uniform; leave and remove indistinguishable to others.
6. **Notify scoping**: an event-vs-recurring group flag; a member's positive fans out
   individual contentless pings to the implied-exposed set, never attributed to the
   group; the join-time disclosure copy (doc 21).
7. **UI**: the calm roster of colors, the join-time honesty, the admin controls
   (invite / remove), leave; wired into the People surface per the nav plan (doc 31).
