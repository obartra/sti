/* Avatars: the DiceBear "Dylan" style, generated locally and recolored to the
   brand teal palette (doc 19). Flat bold forms, a hair style and a mood, in one
   on-brand hue family.

   Privacy: generation is a pure, on-device function of (config) via @dicebear/core.
   We never call the DiceBear HTTP API, which would ship the seed (an alias id) off
   the device and break the no-PHI posture (philosophy principle 6).

   License: the Dylan style is MIT AND CC-BY-4.0. The CC-BY attribution lives in
   src/lib/credits.ts and is surfaced under the avatar editor.

   API (unchanged seam): avatarParts, avatarSrc(cfgOrSeed), avatarFor(handle),
   randomAvatar(seed), isAvatarConfig, migrateAvatar, DEFAULT_AVATAR, pseudonymFor. */

import { createAvatar } from "@dicebear/core";
import * as dylan from "@dicebear/dylan";
import type { Options as DylanOptions } from "@dicebear/dylan";

// The exact option literals Dylan accepts, derived from its own schema so a typo in
// the lists below is a compile error, not a silent fallback at render time.
type HairName = NonNullable<DylanOptions["hair"]>[number];
type MoodName = NonNullable<DylanOptions["mood"]>[number];

// The persisted avatar: three small indices into the lists below. Color is not a
// free choice; `tone` selects one of the on-brand triples.
export interface AvatarConfig {
  hair: number;
  mood: number;
  tone: number;
}

export type AvatarConfigInput =
  | number
  | Partial<AvatarConfig>
  | null
  | undefined;

// A coordinated, on-brand color triple. Hexes are without the leading '#', as
// DiceBear's color options expect, and every value is a token from colors.css so
// the cast stays inside the theme. If the tokens move, move these with them.
interface Tone {
  name: string;
  skin: string; // skinColor
  hair: string; // hairColor
  bg: string; // backgroundColor
}

// Dylan's hair styles (schema order). `name` is the DiceBear option value; `label`
// is the human label shown for accessibility in the builder.
const HAIR: readonly { name: HairName; label: string }[] = [
  { name: "plain", label: "Plain" },
  { name: "wavy", label: "Wavy" },
  { name: "shortCurls", label: "Short curls" },
  { name: "parting", label: "Parting" },
  { name: "spiky", label: "Spiky" },
  { name: "roundBob", label: "Round bob" },
  { name: "longCurls", label: "Long curls" },
  { name: "buns", label: "Buns" },
  { name: "bangs", label: "Bangs" },
  { name: "fluffy", label: "Fluffy" },
  { name: "flatTop", label: "Flat top" },
  { name: "shaggy", label: "Shaggy" },
];

const MOODS: readonly { name: MoodName; label: string }[] = [
  { name: "happy", label: "Happy" },
  { name: "superHappy", label: "Super happy" },
  { name: "hopeful", label: "Hopeful" },
  { name: "neutral", label: "Neutral" },
  { name: "confused", label: "Confused" },
  { name: "sad", label: "Sad" },
  { name: "angry", label: "Angry" },
];

// Five tones built only from colors.css swatches: teal-700 #1F6E80, teal-600
// #277F94, teal-500 #2F9BB3, teal-300 #8FCAD6, teal-100 #DDF0F4, teal-50 #EEF8FA,
// ink-900 #1B1B2F (the brand near-black), and white #FFFFFF.
const TONES: readonly Tone[] = [
  { name: "Teal", skin: "2F9BB3", hair: "1F6E80", bg: "EEF8FA" },
  { name: "Deep", skin: "1F6E80", hair: "1B1B2F", bg: "DDF0F4" },
  { name: "Soft", skin: "8FCAD6", hair: "277F94", bg: "FFFFFF" },
  { name: "Ink", skin: "2F9BB3", hair: "1B1B2F", bg: "FFFFFF" },
  { name: "Mist", skin: "8FCAD6", hair: "1F6E80", bg: "EEF8FA" },
];

export interface AvatarParts {
  hairs: readonly string[];
  moods: readonly string[];
  tones: readonly string[];
}

// The builder needs the option labels and counts; it builds configs by index.
export const avatarParts: AvatarParts = {
  hairs: HAIR.map((h) => h.label),
  moods: MOODS.map((m) => m.label),
  tones: TONES.map((t) => t.name),
};

// The first option of every layer: the default avatar a fresh account starts with
// until the owner customizes it.
export const DEFAULT_AVATAR: AvatarConfig = { hair: 0, mood: 0, tone: 0 };

/**
 * Strict validation for a persisted AvatarConfig (the synced account blob): every
 * field must be an in-range integer index. Fails closed, so an old-shape or corrupt
 * value is rejected here and {@link migrateAvatar} can fall it back to the default.
 */
export function isAvatarConfig(x: unknown): x is AvatarConfig {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  const inRange = (v: unknown, n: number): boolean =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n;
  return (
    inRange(c.hair, HAIR.length) &&
    inRange(c.mood, MOODS.length) &&
    inRange(c.tone, TONES.length)
  );
}

/**
 * Coerce a persisted value to a valid config (doc 19 migration): a valid new-shape
 * config passes through unchanged; anything else (the old animal/color/hat shape, a
 * partial, or corrupt data) falls back to the default. Avatars are cosmetic and
 * re-pickable, so this lossy fallback is the migration. There is no migration job.
 */
export function migrateAvatar(x: unknown): AvatarConfig {
  return isAvatarConfig(x) ? x : DEFAULT_AVATAR;
}

function normalize(cfg: AvatarConfigInput): AvatarConfig {
  if (typeof cfg === "number") return randomAvatar(cfg);
  const c = cfg ?? {};
  return {
    hair: (c.hair ?? 0) % HAIR.length,
    mood: (c.mood ?? 0) % MOODS.length,
    tone: (c.tone ?? 0) % TONES.length,
  };
}

// The Dylan style object for @dicebear/core (its `create`/`meta`/`schema`).
const STYLE = { create: dylan.create, meta: dylan.meta, schema: dylan.schema };

// A constant seed: every visible difference comes from the explicit options below,
// so the same config always renders the same avatar regardless of who owns it.
const AVATAR_SEED = "sti";

function avatarSvg(cfgIn: AvatarConfigInput): string {
  const cfg = normalize(cfgIn);
  const hair = HAIR[cfg.hair] ?? HAIR[0];
  const mood = MOODS[cfg.mood] ?? MOODS[0];
  const tone = TONES[cfg.tone] ?? TONES[0];
  if (!hair || !mood || !tone) {
    throw new Error("avatarSvg: config index out of range");
  }
  return createAvatar(STYLE, {
    seed: AVATAR_SEED,
    // Single-element arrays force the exact choice (DiceBear otherwise picks from
    // the list by seed).
    hair: [hair.name],
    mood: [mood.name],
    skinColor: [tone.skin],
    hairColor: [tone.hair],
    backgroundColor: [tone.bg],
    // No facial hair: it is unrelated to the punk read and would add a random
    // variable to an otherwise fully-specified avatar.
    facialHairProbability: 0,
  }).toString();
}

export function avatarSrc(cfg: AvatarConfigInput): string {
  return "data:image/svg+xml," + encodeURIComponent(avatarSvg(cfg));
}

export function randomAvatar(seed: number): AvatarConfig {
  // Avalanche the seed (xorshift-multiply, same family as pseudonymFor) so even
  // adjacent seeds spread across the whole 12 x 7 x 5 space. The three fields are
  // taken as successive "digits" of the mixed value via division, not low-bit
  // modulo, which would cluster.
  let h = (seed >>> 0) || 1;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return {
    hair: h % HAIR.length,
    mood: Math.floor(h / HAIR.length) % MOODS.length,
    tone: Math.floor(h / (HAIR.length * MOODS.length)) % TONES.length,
  };
}

export function avatarFor(handle: string): string {
  let h = 0;
  const str = handle || "";
  for (let i = 0; i < str.length; i++)
    h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  return avatarSrc(randomAvatar(h));
}

// Wordlists for the id-derived pseudonym (doc 15). Lowercase [a-z] only, neutral,
// and deliberately generic so the handle reads as a label, not a trait.
const PSEUDONYM_ADJECTIVES: readonly string[] = [
  "swift",
  "quiet",
  "bright",
  "calm",
  "brave",
  "clever",
  "cosmic",
  "dapper",
  "eager",
  "fancy",
  "gentle",
  "happy",
  "jolly",
  "keen",
  "lively",
  "lucky",
  "mellow",
  "merry",
  "noble",
  "plucky",
  "proud",
  "quick",
  "royal",
  "sandy",
  "sleepy",
  "snug",
  "spry",
  "sunny",
  "tidy",
  "vivid",
  "witty",
  "zesty",
];
const PSEUDONYM_NOUNS: readonly string[] = [
  "maple",
  "river",
  "pebble",
  "cloud",
  "ember",
  "meadow",
  "harbor",
  "lantern",
  "willow",
  "cedar",
  "comet",
  "dune",
  "fern",
  "garnet",
  "hazel",
  "isle",
  "jade",
  "kite",
  "lake",
  "moss",
  "nimbus",
  "opal",
  "pine",
  "quartz",
  "reef",
  "summit",
  "thistle",
  "umber",
  "vale",
  "wave",
  "yarn",
  "zephyr",
];

/**
 * A deterministic, id-derived display handle for an alias with no chosen handle
 * (doc 15). The same id always yields the same `adjective_noun_NN`, distinct ids
 * differ, and it reveals nothing because the id is random per alias. The two-digit
 * suffix lifts the space to ~10^5 (32 x 32 x 100) so collisions across one owner's
 * aliases stay rare (see doc 15 limits). Output is in the handle charset, well
 * under the 64-char cap.
 */
export function pseudonymFor(id: string): string {
  // FNV-1a over the id, then an xorshift-multiply avalanche, so even ids that
  // differ in one character spread across the whole space. The three fields are
  // taken from HIGH-order bits (via division, not low-bit modulo) because an id's
  // low bits are the least mixed.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0; // keep unsigned: `^` yields a signed int otherwise
  const adj = PSEUDONYM_ADJECTIVES[h % PSEUDONYM_ADJECTIVES.length] ?? "swift";
  const noun =
    PSEUDONYM_NOUNS[Math.floor(h / 32) % PSEUDONYM_NOUNS.length] ?? "river";
  const num = String(Math.floor(h / 1024) % 100).padStart(2, "0");
  return `${adj}_${noun}_${num}`;
}
