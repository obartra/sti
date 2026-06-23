# sti.care: Per-alias Identity

_New, June 21, 2026._

_The design doc for making the displayed identity (handle + avatar) per-alias, so the locked
"opaque-id aliases are the default, vanity is an opt-in" choice actually holds. It builds on the
avatar-in-card work already shipped (PRs #55, #63) and corrects the "avatar correlation is accepted"
limit those landed with. Built in tested slices on top of current `main`._

---

## Why this doc

A viewer who decrypts a passport sees a face: a handle and an avatar. Today both come from the
account (`accountBlob.ts`: one `handle`, one `avatar`), and `deriveOwnerCard` stamps them onto every
card. The opaque alias id is already per-alias and random, so two aliases are unlinkable to the
server and to anyone reading URLs. But the moment two people each decrypt a card from the same owner,
they see the same `@handle` and the same avatar and can link the two aliases, which is the exact
thing per-context aliases exist to prevent.

So the id layer is unlinkable and the content layer is not. This doc closes that gap by making the
displayed face per-alias, unlinkable by default and recognizable by opt-in.

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

## Correcting a shipped rationale

PRs #55 and #63 put the owner's avatar in the card (a real improvement). They landed with a limit
this doc reverses. Today's text, in [doc 13](13-contact-graph-and-notification.md) ("Avatar
viewer-correlation ... no worse than before ... Accepted") and in `publicCard.ts` ("adds no
correlation surface"), argues the shared avatar is fine because the handle already correlates aliases
too. That is backwards: the handle correlating is the *same bug*, not a justification. Both the
handle and the avatar are account-wide today and both should be per-alias. This doc treats that
correlation as a surface to remove, and updates those two notes to point here.

## The product call this rests on

Two goals conflict: **recognizability** (a contact sees the face you built and knows it is you) and
**unlinkability** (two of your aliases cannot be tied together by their face). You cannot have both
for the same alias, because a recognizable face is a linkable one. The resolution is per-alias
choice, unlinkable by default and recognizable by opt-in, taught at the moment the user picks
(principle 10). This matches the locked "opaque-id default, vanity opt-in."

## What is already locked (this doc must not relitigate)

- **No user-facing "main handle." The only ids are aliases;** the local account key is the anchor.
  (02 §Identity)
- **Opaque-id aliases are the default; a vanity/custom handle is an explicit opt-in,** flagged as
  findable and not unlinkable. (02 §Identity)
- **Display identity = handle/alias + avatar, never a real name.** (02)
- **No central identity index; the server never sees a handle.** (01 principle 6, 02 §Identity)
- **Each contact gets its own alias** (`ContactRecord.alias`); the public profile and casual link are
  reused singletons (`shareLinkFor` finds one alias per visibility). (02/13, `session.ts`)
- **Public vs private is a key-distribution choice the server cannot see;** the address is uniformly
  `/a/<id>` either way. (02)

## The gap (current state, verified against `main`)

- The account blob (`accountBlob.ts`, v8) holds one `handle` and one `avatar`. `deriveOwnerCard`
  stamps both onto every card (#55).
- Onboarding **forces** a memorable handle (min 3 chars; `ClaimCreateFlow.tsx`), inverting the locked
  opaque-default.
- The card wire (`publicCard.ts`, v2-only) already carries `handle` and an optional `avatar`.

Net: the id is per-alias, but the face is account-wide, a cross-alias correlation surface. Only
per-contact aliases are one-per-person; the public and casual aliases are reused singletons, so
per-recipient unlinkability is a property of the per-contact aliases.

## Decisions (proposed, for confirmation)

1. **Unlinkable by default for every alias, derived deterministically from its id.** With no override,
   a card's face is a pure function of the alias's own opaque id: `pseudonymFor(id)` in the handle slot
   and `avatarFor(id)` for the avatar. Same id always yields the same face (stable across republishes
   and devices, nothing stored); different aliases differ because their ids differ; the face is linked
   to nothing because the id is random and per-alias. This holds for the public alias too (public
   visibility and a findable identity are orthogonal).

   _Divergence to confirm:_ the locked text says the default is "the opaque id." We render a
   deterministic id-derived **pseudonym** (adjective + noun, in the handle charset) rather than the raw
   id, for readability. Same zero cross-alias linkage, not a real name (generated), but an
   interpretation of the locked decision, so it is flagged.

2. **Recognizable is an opt-in per-alias override, stored as a plain display label.** Each alias gets
   optional `handle` and `avatar` fields. Set them and the card shows them; leave them and the card
   derives from the id. These are display values, not addresses: not unique, not in the URL, no
   registry. At mint the fields are pre-filled with the owner's account `handle`/`avatar` so "show the
   real me" is one tap (it copies those values in), with the findable + linkable warning inline.

3. **The account `handle` + `avatar` stay as-is, as the owner's main identity.** No rename, no schema
   move. They are what Home shows and the pre-fill for overrides; they are simply no longer stamped
   onto every card automatically.

4. **No card-wire change.** The v2 card already carries `handle` + optional `avatar`. This changes only
   the *source* `deriveOwnerCard` resolves them from. Anonymous resolution seals `pseudonymFor(id)` in
   the handle slot and omits the avatar, so the shipped viewer fallback (`avatarFor(handle)`) renders
   the id-derived avatar with no new code; an override seals the chosen values exactly as cards do
   today.

## Data model

Additive only. The account keeps `handle` + `avatar`; each alias gains two optional override fields:

```
// accountBlob.ts, unchanged: handle + avatar ARE the main identity (Home + mint pre-fill)
account: { handle, avatar, aliases, contacts, ... }

// AliasRecord (the public/casual aliases AND each ContactRecord.alias) gains:
alias: {
  id, writeToken, key, isPublic,
  handle?: string,        // optional per-alias display override; absent => pseudonymFor(id)
  avatar?: AvatarConfig,  // optional per-alias display override; absent => avatarFor(id) via fallback
}
```

No discriminated union, no reference, no propagation machinery: an override is just the value to show,
absent is the deterministic default. The override is a plain display label validated like any other
field (`handle` against `isValidHandle`, `avatar` against `isAvatarConfig`).

**Publish-time resolution** (`deriveOwnerCard`, per alias):

```
handle = alias.handle ?? pseudonymFor(id)
avatar = alias.avatar                       // omitted if unset; viewer falls back to avatarFor(handle)
```

`pseudonymFor` is a deterministic id-derived label (adjective + noun, emitted in the handle charset
lowercase `[a-z0-9_]`, within the 64-char limit, the handle-slot counterpart of `avatarFor`); see
Honest limits for its required wordlist size. `deriveOwnerCard` currently takes `(state, handle,
nowDay, avatar?)`; it gains the alias's id + optional overrides so it resolves per alias.

**Schema:** bump `accountBlob.ts` v8 to v9, adding the two optional fields on `AliasRecord`, parsed
exclusively (no migration), exactly as v5 to v8 were added. No real accounts in the wild (the
established assumption in `accountBlob.ts`), so there is nothing to migrate.

**On the server:** unchanged. The address stays `/a/<id>`; the face is inside the sealed card.

## Owner UX

- **Onboarding:** stop forcing a vanity handle. Build a main identity (handle + avatar) framed as the
  face you can *choose* to show; the default alias stays opaque.
- **Mint a link / share:** the override fields, pre-filled with your main identity, with a clear
  "anonymous (default) vs show my identity" choice and the findable + linkable warning on the opt-in.
- **Public profile:** defaults to anonymous like any other alias; showing a recognizable identity is
  the opt-in that makes it findable.
- **Home:** shows your main identity (unchanged feel).
- **"What others see" preview:** becomes per-alias, previewing the face that alias resolves to (the
  self-preview screen needs the alias context it does not carry today).

## Non-goals

- **No uniqueness, registry, dedup, or vanity-URL namespace.** The handle is a display label, not an
  address; uniqueness is neither needed nor wanted (it would require a central index, forbidden).
- **No automatic propagation of a main-identity edit.** An override is copied in at mint, so changing
  your account handle/avatar later does not retro-update aliases you already stamped. This is a
  deliberate trade for simplicity (and is arguably more honest: what you set is what shows). Editing a
  specific alias's face stays a per-alias action.
- **No server-side identity;** the server never learns a face. Unchanged.
- **No account-schema rename;** purely additive.

## Proposed build slices (each its own tested PR)

1. **Schema v9:** add optional `handle` + `avatar` to `AliasRecord` with strict validators; parse v9
   exclusively. No behavior change. Validated against the live blind store.
2. **Per-alias resolution in `deriveOwnerCard`:** resolve `alias.handle ?? pseudonymFor(id)` and the
   optional `alias.avatar`; add `pseudonymFor`; thread the alias id + overrides into the publish path.
   Every alias defaults to its deterministic id-derived face.
3. **Mint-time override UI + linkability warning** (Connect / share sheet): pre-filled fields,
   anonymous vs show-my-identity, taught at the choice point.
4. **Onboarding:** build a main identity, opaque default alias; drop the forced vanity handle.
5. **Per-alias self-preview:** thread alias context into "what others see."

## Honest limits (carried, stated)

- **Avatar entropy is low.** The id-derived avatar draws from a few hundred combinations
  (`avatars.ts`, doc 19: 12 hair x 7 mood x 5 tone), so two anonymous alias avatars can collide by
  chance; the avatar is a weak signal.
- **The pseudonym is the real separator, so it must be sized for it.** Anonymous unlinkability rests on
  `pseudonymFor` rarely colliding across the aliases one owner mints. For a heavy user minting dozens
  of links, keeping collisions well under ~1% wants on the order of 10^5 combinations (e.g. ~300
  adjectives x ~300 nouns); smaller wordlists make the pseudonym a correlation hint.
- **Opt-in recognizability is linkable, by design.** Showing the same face to two contacts is a chosen
  linkable identity; the tool's duty is to make that an informed choice, not to prevent it.
- **Behavioral correlation is out of scope:** per-alias faces do nothing about timing-based
  correlation of the existing republish fan-out (`ownerCard.ts`, doc 11).
