# sti.care: Per-alias Identity

_The displayed identity (handle + avatar) is per-alias, so the locked "opaque-id aliases are the
default, vanity is an opt-in" choice holds at the content layer, not just the address. A card's face
is unlinkable by default (derived deterministically from the alias's own opaque id) and recognizable
only by opt-in. This closes the shared-face correlation the earlier avatar-in-card work landed with._

---

## Why per-alias

A viewer who decrypts a passport sees a face: a handle and an avatar. The opaque alias id is already
per-alias and random, so two aliases are unlinkable to the server and to anyone reading URLs. Before
this, though, the handle and avatar came from the account (one `handle`, one `avatar`) and
`deriveOwnerCard` stamped both onto every card, so the moment two people each decrypted a card from
the same owner they saw the same `@handle` and the same avatar and could link the two aliases, the
exact thing per-context aliases exist to prevent.

So the id layer was unlinkable and the content layer was not. The displayed face is now per-alias:
unlinkable by default and recognizable by opt-in, closing that gap.

## Address and handle are separate (and stay separate)

This is the load-bearing distinction, and it is why the design stays simple:

- The **address** is the opaque alias id in the URL (`/a/a7f3k9q2`). It is random, per-alias, and the
  only thing the server ever sees. It is unguessable and not enumerable.
- The **handle** is a display name living *inside* the encrypted card. The server never sees it.

Because the handle is a display label and not the address, **it does not need to be unique**, and
there is no registry, no dedup, no handle-claiming, and no `/u/` vs `/p/` namespace. Two owners can
both display `@meow` with zero conflict, because what resolves a card is the opaque id, not the word.
Uniqueness would only be forced if the handle were the address, and merging those two is exactly what
would break blindness (a central handle index, the handle in the URL, enumerable vanity URLs), all of
which the privacy model forbids (philosophy principle 6, doc 02 §Identity). So we keep them separate.

## The shared-face correlation this closed

Putting the owner's avatar in the card was a real improvement, but it landed with a limit this
reverses. The earlier reasoning (in [doc 13](13-contact-graph-and-notification.md) and in
`publicCard.ts`) argued the shared avatar was fine because the handle already correlated aliases too.
That was backwards: the handle correlating was the *same bug*, not a justification. Both the handle
and the avatar were account-wide and both are now per-alias, so neither is a cross-alias correlation
surface by default.

## The product call this rests on

Two goals conflict: **recognizability** (a contact sees the face you built and knows it is you) and
**unlinkability** (two of your aliases cannot be tied together by their face). You cannot have both
for the same alias, because a recognizable face is a linkable one. The resolution is per-alias
choice, unlinkable by default and recognizable by opt-in, taught at the moment the user picks
(principle 10). This matches the locked "opaque-id default, vanity opt-in."

## What this rests on (locked)

- **No user-facing "main handle." The only ids are aliases;** the local account key is the anchor.
  (02 §Identity)
- **Opaque-id aliases are the default; a vanity/custom handle is an explicit opt-in,** flagged as
  findable and not unlinkable. (02 §Identity)
- **Display identity = handle/alias + avatar, never a real name.** (02)
- **One allowed index:** the public handle registry (`name → aliasId`) for Public links, an
  explicit opt-in with disclosure. The server never sees a local display name or a per-alias
  display handle. (01 principle 6 revised, 16 §Public link)
- **Each contact gets its own alias** (`ContactRecord.alias`); the public profile and casual link are
  reused singletons (`shareLinkFor` finds one alias per visibility). (02/13, `session.ts`)
- **Public vs private is a key-distribution choice the server cannot see;** the address is uniformly
  `/a/<id>` either way. (02)

Net: the id is per-alias, and so is the face. Only per-contact aliases are one-per-person; the public
and casual aliases are reused singletons, so per-recipient unlinkability is a property of the
per-contact aliases.

## How the face is chosen

**Unlinkable by default, derived deterministically from the alias id.** With no override, a card's
face is a pure function of the alias's own opaque id: `pseudonymFor(id)` in the handle slot and the
id-seeded avatar. Same id always yields the same face (stable across republishes and devices, nothing
stored); different aliases differ because their ids differ; the face is linked to nothing because the
id is random and per-alias. This holds for the public alias too (public visibility and a findable
identity are orthogonal). The default renders a readable id-derived **pseudonym** (adjective + noun +
suffix, in the handle charset) rather than the raw id: same zero cross-alias linkage, a generated
label rather than a real name.

**Recognizable is an opt-in per-alias override, stored as a plain display label.** Each alias carries
optional `handle` and `avatar` fields. Set them and the card shows them; leave them and the card
derives from the id. These are display values, not addresses: not unique, not in the URL, no registry.
**Anonymous is the default** (the id-derived face); choosing "show my name" copies the owner's main
identity (their local name + avatar) onto that alias, with the findable + linkable warning inline. A
"show my name" link can also carry a per-link avatar override, so two revealed links need not wear an
identical face. This is the "faces" model in [doc 31](31-app-shape.md): recognizability rides on the
handle, and the local name only seeds it, defaulting to not-shared.

**The owner keeps a local name and an avatar.** The account holds one local display name
(owner-facing, never sent) that powers Home's greeting and seeds the recognizable handle, plus the
owner's avatar. Faces (handle + avatar) belong to aliases; the account identity is the default a
"show my name" link copies from, never something the server sees.

**No card-wire change.** The published card already carries `handle` + optional `avatar`; only the
*source* `deriveOwnerCard` resolves them from is per-alias. Anonymous resolution seals
`pseudonymFor(id)` in the handle slot and omits the avatar, so the viewer's fallback renders the
id-derived avatar (seeded on the opaque alias id it carries, never on the readable handle); an
override seals the chosen values exactly as cards do today.

## Data model

The account holds a local **name** (Home greeting + recognizable-handle seed) and an avatar; each
alias carries two optional override fields:

```
// accountBlob.ts
account: { handle /* local name, never sent */, avatar, aliases, contacts, ... }

// AliasRecord (the public/casual aliases AND each ContactRecord.alias):
alias: {
  id, writeToken, key, isPublic,
  handle?: string,        // optional per-alias display override; absent => pseudonymFor(id)
  avatar?: AvatarConfig,  // optional per-alias display override; absent => id-derived avatar
}

// ContactRecord (receiver side) already carries the local rename:
contact: { ..., label /* a private nickname only the receiver sees; never sent */ }
```

**Whose name shows, in resolution order.** What a receiver sees for a contact is, in order: their
own **local label** (the `ContactRecord.label`, device-only, never sent), else the **live face the
sharer chose** (the alias `handle` override, or the id-derived pseudonym). The sharer's optional
shared name is not a separate live layer: it is delivered once as the **initial value** of that
label, which the receiver then owns and edits, and it never re-syncs if the sharer later changes
their name. The handle underneath stays live (it follows whatever the sharer sets); a shared name is
a one-time snapshot. So the shared name and the receiver's rename are the same editable label, just
seeded differently (doc 31) - readability on top of the always-present handle, neither of which the
server ever sees.

No discriminated union, no reference, no propagation machinery: an override is just the value to show,
absent is the deterministic default. The override is a plain display label, validated like any other
field (the `handle` against `isValidHandle`; a bad or old-shape override `avatar` is cosmetic and
migrates to the id-derived default on read, doc 19, so it never bricks the alias).

**Publish-time resolution** (`resolveCardIdentity` per alias, composed into the card by
`deriveAliasCard`):

```
handle = alias.handle ?? pseudonymFor(id)
avatar = alias.avatar                       // omitted if unset; viewer falls back to the id-derived avatar
```

`pseudonymFor` is a deterministic id-derived label of the form `adjective_noun_NN` (a word pair plus
a two-digit suffix, emitted in the handle charset lowercase `[a-z0-9_]`, within the handle length
limit, the handle-slot counterpart of the id-seeded avatar); see Honest limits for its wordlist size.

**Schema.** The per-alias `handle?`/`avatar?` fields live on `AliasRecord` in `accountBlob.ts`, parsed
strictly (the current version is parsed exclusively, no migration path). There are no real accounts in
the wild, the established assumption in `accountBlob.ts`, so there is nothing to migrate.

**On the server:** unchanged. The address stays `/a/<id>`; the face is inside the sealed card.

## Owner UX

- **Onboarding:** collects only an optional **local display name** (account-level, owner-facing, never
  sent to the server); no vanity handle is forced, and the default alias stays opaque
  (`pseudonymFor(id)`). A skippable disclosure adds an optional public username + password (doc 32),
  so the passkey/phrase path stays the uncluttered default. A fresh account starts with a random
  avatar, customized later from the dedicated editor (doc 19).
- **Mint a public link / share:** the share sheet offers the per-alias choice, "anonymous (default)"
  vs "show my name," pre-filled from the local name + avatar. Choosing "show my name" surfaces the
  findable + linkable teaching, and a per-link face control lets the owner pick a different avatar for
  this one link so two revealed links stay apart.
- **Private link share:** same override, anonymous by default; recognizable is an opt-in with no
  namespace claim and no linkable warning required (the link is not findable).
- **Home:** greets you by your local name.
- **"What others see" preview:** a viewer always opens one specific link, so the self-preview is
  per-alias (doc 31): the owner picks which link to preview and sees the exact face that link
  resolves to, the id-derived anonymous face by default or their identity where they stamped it.

## Non-goals

- **No uniqueness, registry, dedup, or vanity-URL namespace.** The handle is a display label, not an
  address; uniqueness is neither needed nor wanted (it would require a central index, forbidden).
- **No automatic propagation of a main-identity edit.** An override is copied in at mint, so changing
  your account name/avatar later does not retro-update aliases you already stamped. This is a
  deliberate trade for simplicity (and is arguably more honest: what you set is what shows). Editing a
  specific alias's face stays a per-alias action.
- **No server-side identity;** the server never learns a face.
- **No account-schema rename;** the per-alias fields are additive.

## Honest limits

- **Avatar entropy is low.** The id-derived avatar draws from only a few hundred combinations
  (`avatars.ts`, doc 19: a small set each of hairstyle x mood x skin tone x hair color; see the live
  arrays for exact counts), so two anonymous alias avatars can collide by chance; the avatar is a weak
  signal.
- **The pseudonym is the real separator, so it is sized for it.** Anonymous unlinkability rests on
  `pseudonymFor` rarely colliding across the aliases one owner mints. The wordlists are
  256 x 256 = 65,536 pairs (`pseudonymWords.ts`, matching the no-unique-tag promise), and the
  `adjective_noun_NN` form appends a two-digit suffix, lifting the full label space to
  256 x 256 x 100 = ~6.5M. The suffix guards full-label collisions; the word PAIR is still the real
  correlation hint, so unlinkability is sized on the 65,536 pairs. That keeps an exact-pair collision
  uncommon for a heavy user minting dozens of links (a few percent at most), but not vanishing; the
  handle is sized as a separator, not a promise of zero collisions, and growing the lists toward
  ~10^5 pairs is the lever if that margin ever needs to widen.
- **Opt-in recognizability is linkable, by design.** Showing the same face to two contacts is a chosen
  linkable identity; the tool's duty is to make that an informed choice, not to prevent it.
- **Behavioral correlation is handled separately:** per-alias faces do nothing about timing-based
  correlation of the republish fan-out, but that fan-out is decorrelated server-side (the batch is
  applied at independent jittered times, `ownerCard.ts` / [doc 18](18-sibling-alias-decorrelation.md)),
  so the same-instant burst no longer links an owner's aliases. The residual is the origin seeing the
  batch grouping (doc 18 honest limits), not a timing signal a downstream observer can read.
