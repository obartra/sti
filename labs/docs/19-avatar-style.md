# sti.care: Avatar Style (Dylan)

_The design doc for replacing the home-grown animal avatars (`passport/src/lib/avatars.ts`) with the
DiceBear "Dylan" style, rendered locally and recolored to the brand teal palette. It keeps every property
the current system earned (no photos, offline, deterministic from a per-alias seed, encrypted-blob
config) and changes only what produces the SVG. Built in tested slices on top of current `main`._

---

## Why this doc

The avatar is the face a viewer sees when they decrypt a passport (doc 15 made it per-alias). The
current art is hand-drawn SVG: six animals, five color triples, a couple of hats and glasses. It
works and it is private, but it looks home-made, and the accessory layer it was built around
(`ear` / `nose` / `cheek` anchors, the cut `EXTRAS`) never shipped. Rather than keep drawing, we pull
from a maintained illustration library that already looks good.

The chosen look is DiceBear's Dylan: flat, bold, curved forms with expressive moods, recolored to the
brand teal palette so the whole cast reads as one family and sits inside the existing tokens. The vibe
target is "half corporate cartoon, half punk": clean shapes, spiky hair, a face with a mood.

This doc changes the avatar's *rendering and config*. It does not touch the card payload, keys, the
knock/grant crypto, or where avatars are displayed.

## Avatars are per-face only, not an owner photo (doc 31)

The owner has **no avatar of their own** (doc 31): an avatar is part of a **face** the owner chooses
when they share, never an account-level profile photo. So this doc's generator/builder is correct,
but its home is the **recognizable-face choice at share time** (and the "your handles" management in
Settings), not an account "edit your avatar" surface. Where the slices below say the editor lives in
Privacy / is set at signup, read that as the per-alias face editor: a fresh account has no owner
avatar to set, and the builder appears when the owner opts a specific share into a recognizable face.

Everything outside `avatars.ts` consumes avatars through two functions and one shape:

- `avatarSrc(config)` returns a `data:image/svg+xml,...` URI (the `Avatar` component, cards, shared
  links all use this).
- `avatarFor(seed)` returns the deterministic default URI for an alias that has not customized.
- `AvatarConfig`, the small object persisted in the encrypted account blob.

We keep all three. `avatarSrc` still returns a data URI, so the `Avatar` component and every call site
are unchanged. What changes is what happens *inside*: instead of concatenating path strings, we call
DiceBear's local generator and serialize its SVG to the same data URI. The swap lives entirely behind
this seam.

## Offline and deterministic, same as today

Two non-negotiables carry over from the current system, and both are satisfied by DiceBear's JS core,
not its HTTP API.

- **Offline.** We use `@dicebear/core` + `@dicebear/collection` (the Dylan style) as bundled
  dependencies. The SVG is generated on-device. We never call `api.dicebear.com`: that would ship the
  seed (an alias identifier) to a third party and break the no-PHI-off-device posture (philosophy
  principle 6). A test asserts no network access in the avatar path.
- **Deterministic.** DiceBear is a pure function of `(seed, options)`. `avatarFor` passes the alias's
  opaque id as the seed (not the handle, which can be user-chosen and identifying), so the same alias
  always yields the same default face and distinct aliases differ. The opaque id is already random and
  per-alias (doc 15), so a derived avatar reveals nothing.

We pin an exact DiceBear version. A library version bump can change generated output, so the version is
a snapshot-tested constant, bumped deliberately, never floated.

## On-brand palette, and what the builder offers

Dylan's real options are `hair` (12 styles: plain, wavy, shortCurls, parting, spiky, roundBob,
longCurls, buns, bangs, fluffy, flatTop, shaggy), `mood` (7: happy, superHappy, hopeful, neutral,
confused, sad, angry), and the `hairColor` / `skinColor` / `backgroundColor` palettes.

To stay on brand the color is constrained to **one shared palette**, not free choice. The palette is
drawn straight from `colors.css` and sorted light to dark:

- white #FFFFFF, `--teal-100` (#DDF0F4), `--teal-300` (#8FCAD6), `--teal-500` (#2F9BB3),
  `--teal-700` (#1F6E80), `--ink-900` (#1B1B2F) (the brand near-black)

Skin and hair color are chosen **separately** from this palette (more variety than a single fixed
tone, but every value is still on brand, so no combination can produce mud). Skin and hair use almost
the same set, with one difference: hair's darkest is the brand near-black (`--ink-900`), but skin's
darkest is a blue-tinted teal-dark (#16505C) instead, because the eyes render in black and would vanish
against a near-black face. The background is **not** a user choice: it is picked automatically to
contrast with the skin and hair (a light avatar gets the deep tint, a dark one the pale tint), choosing
the candidate that maximizes the weaker of its two WCAG contrasts so neither part blends in. Both
candidates (`--teal-50`, `--teal-700`) are on brand. The raw DiceBear palettes are never exposed. The
builder offers, in a fixed-column grid, with color rows shown as plain color swatches and asset rows as
mini avatars:

- **Beard** (clean-shaven or Dylan's one beard style), placed first.
- **Hair** (12 Dylan styles + **Bald**). Dylan has no no-hair style, so Bald reuses the flattest style
  with the hair color forced to the skin, so the hair reads as a bare head.
- **Mood** (6: happy, super happy, hopeful, neutral, confused, angry). The personality knob the old
  "hat / glasses" rows never were.
- **Skin** and **Hair color** (6 swatches each, from their palettes).
- **Surprise me**, a shuffle button (the current `randomAvatar` has no UI today).

`AvatarConfig` becomes `{ hair, mood, skin, hairColor, beard }` (small in-range indices, same
fail-closed validation discipline as `isAvatarConfig`). The palette is the single source of truth; if
the theme tokens change, the avatars change with them.

The default link preview ("what a link shows") deliberately keeps showing the anonymous, id-derived
face, not the built avatar: links are anonymous by default and the avatar appears only when the owner
reveals a link (doc 15 / 16). The copy is sharpened to say so rather than changing that behavior.

## Migration off the old config

Avatars are per-alias and recently shipped (PRs #55, #63, doc 15), so real persisted `AvatarConfig`
blobs exist with the old `{ animal, color, hat, glasses, extra }` shape. They cannot map meaningfully
onto Dylan. Because avatars are cosmetic and re-pickable, the migration is simple and lossy on purpose:

- A new strict validator accepts only the new shape.
- On load, any value that is not a valid new config (old shape, partial, corrupt) falls back to the
  deterministic default derived from the alias id, exactly as a never-customized alias would.
- The owner can re-pick at any time; the new pick persists in the new shape.

No data migration job, no dual-read window. The fallback path *is* the migration.

## License

The Dylan package is `MIT AND CC-BY-4.0`. CC-BY-4.0 requires attribution, so we add a one-line credit
(style name + author + license) to a credits/licenses surface. This is the only obligation; it cannot
be skipped.

## What we give up

- **No piercings / earrings / glasses.** Dylan has no accessory layer (only `facialHair`). The original
  brief asked for piercings; they do not exist in this style. The punk read comes from spiky hair +
  monotone + mood instead. If accessories become a hard requirement later, the only DiceBear style with
  them and a comparable line look is "lorelei"; switching is another pass at this same seam.
- **Free color choice.** Skin and hair color are chosen separately but only from the brand palette,
  not Dylan's full palettes, and the background is fixed. This is deliberate; it keeps every avatar on
  brand.
- **A real bald style.** Dylan has none, so Bald is approximated by matching the hair color to the
  skin. It reads as a bare head but is not a true no-hair render.

## Testing

- Deterministic snapshot: `avatarFor(id)` is stable for a fixed id and pinned library version.
- Distinctness: different ids produce different output.
- Validator round-trips the new shape and rejects every old/partial/corrupt blob.
- Migration: a stored old-shape config loads as the derived default, not an error.
- Offline: the avatar path makes no network call.
- On brand: every defined tone produces an SVG containing only theme-swatch hexes (no stray default
  skin/hair colors leaking through), for all tone values.

## Slices

1. Add pinned DiceBear deps; implement the new `avatars.ts` internals behind the unchanged
   `avatarSrc` / `avatarFor` / `AvatarConfig` seam, with the theme-derived tone triples defined. Tests:
   determinism, offline, on-brand palette across all tones.
2. New validator + load-time fallback migration. Tests: round-trip, legacy fallback.
3. Rebuild `AvatarBuilder.tsx`: hair + mood + tone chips as mini-avatar swatches, shuffle button.
   Story + interaction test.
4. Add the CC-BY attribution line. Update any avatar-related references in docs 15 / 16.
5. Make the editor reachable and persistent. The `avatar-edit` route existed but
   nothing navigated to it, and its handler edited local state then discarded it on
   close, so a post-onboarding owner could never change their avatar. Add an
   `onSetAvatar` owner action (`controller.setProfile` with the current sharing
   mode, folded back into the session like the other owner mutations), thread it to
   the route so "Done" persists, and add an "Edit your avatar" entry in the Privacy
   screen with a live preview of the current avatar.
6. More variety (this slice). Replace the single coordinated `tone` with separate
   skin and hair color picks from one light-to-dark palette; add a beard toggle and
   a Bald hair option; lay the builder swatches out in a fixed-column grid; and
   sharpen the default-link-preview copy (keeping the anonymous-by-default face).
   `AvatarConfig` becomes `{ hair, mood, skin, hairColor, beard }`; old-shape blobs
   (including the interim `{ hair, mood, tone }`) coerce to the default on read.
7. Move the builder out of signup. The avatar is not shown on a link by default
   (it is anonymous), so building it during account creation is premature and makes
   that screen long. A fresh account now gets a **random** avatar; the full builder
   lives only on the dedicated `avatar-edit` screen, reached from the Privacy screen
   and from private-link creation (where a revealed avatar is actually seen). The
   "Surprise me" button gets a dice icon. Background also auto-contrasts with the
   avatar; the darkest skin is blue-tinted so the eyes read; the sad mood is dropped.
