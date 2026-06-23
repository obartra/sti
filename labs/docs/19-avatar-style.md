# sti.care: Avatar Style (Dylan)

_New, June 22, 2026._

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

## The boundary: swap the generator, keep the seam

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

To stay on brand the color is constrained to **the existing theme swatches**, not free choice. The
source set is drawn straight from `colors.css`:

- three teals: `--teal-700` (#1F6E80), `--teal-500` (#2F9BB3), `--teal-300` (#8FCAD6)
- one near-black: `--ink-900` (#1B1B2F) (the brand never uses pure black)
- white: #FFFFFF

From those swatches we define 5 named **tones**, each a coordinated `skinColor` / `hairColor` /
`backgroundColor` triple, so a single pick always lands a coherent, on-brand face and no combination
can produce mud. Every Dylan slot that supports color is filled from this set; the raw DiceBear
palettes are never exposed. The builder offers three choices plus a die:

- **Hair** (12 chips), rendered as mini-avatar swatches rather than text.
- **Mood** (7 chips). Picking a mood is the personality knob the old "hat / glasses" rows never were.
- **Tone** (5 swatches built from the theme colors). The only color control, bounded to the brand set.
- **Surprise me**, a shuffle button (the current `randomAvatar` has no UI today).

`AvatarConfig` becomes `{ hair: number, mood: number, tone: number }` (small in-range indices, same
fail-closed validation discipline as `isAvatarConfig`). The tone triples are the single source of
truth; if the theme tokens change, the tones change with them.

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
- **Free color choice.** Color is limited to tones built from the theme swatches rather than Dylan's
  full palettes. This is deliberate; the tones keep every avatar on brand.

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
