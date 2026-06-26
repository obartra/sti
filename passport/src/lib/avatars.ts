/* Avatars: the DiceBear "Dylan" style, generated locally and recolored to the
   brand teal palette (doc 19). Flat bold forms: a hair style, skin and hair colors,
   a mood, and a beard, all from one on-brand palette sorted light to dark.

   Privacy: generation is a pure, on-device function of (config) via @dicebear/core.
   We never call the DiceBear HTTP API, which would ship the seed (an alias id) off
   the device and break the no-PHI posture (philosophy principle 6).

   License: the Dylan style is MIT AND CC-BY-4.0. The CC-BY attribution lives in
   src/lib/credits.ts and is surfaced under the avatar editor.

   API (unchanged seam): avatarParts, avatarSrc(cfgOrSeed), avatarFor(seed),
   randomAvatar(seed), isAvatarConfig, migrateAvatar, DEFAULT_AVATAR, pseudonymFor. */

import { createAvatar } from "@dicebear/core";
import * as dylan from "@dicebear/dylan";
import type { Options as DylanOptions } from "@dicebear/dylan";

// The exact option literals Dylan accepts, derived from its own schema so a typo in
// the lists below is a compile error, not a silent fallback at render time.
type HairName = NonNullable<DylanOptions["hair"]>[number];
type MoodName = NonNullable<DylanOptions["mood"]>[number];

// The persisted avatar: small indices into the lists below. Colors come from one
// shared on-brand palette, chosen separately for skin and hair.
export interface AvatarConfig {
  hair: number;
  mood: number;
  skin: number;
  hairColor: number;
  beard: number;
}

export type AvatarConfigInput =
  | number
  | Partial<AvatarConfig>
  | null
  | undefined;

// One palette swatch. Hex is without the leading '#', as DiceBear's color options
// expect, and every value mirrors a colors.css token so avatars stay on brand.
// Kept as literals (this runs outside the DOM); if the tokens move, move these too.
interface Swatch {
  name: string;
  hex: string;
}

// Dylan's hair styles (schema order), plus a synthetic "Bald": Dylan has no
// no-hair style, so Bald reuses the flattest style with the hair color forced to
// the skin (see avatarSvg) so it reads as a bare head. `name` is the DiceBear value.
const HAIR: readonly { name: HairName; label: string; bald?: boolean }[] = [
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
  { name: "plain", label: "Bald", bald: true },
];

const MOODS: readonly { name: MoodName; label: string }[] = [
  { name: "happy", label: "Happy" },
  { name: "superHappy", label: "Super happy" },
  { name: "hopeful", label: "Hopeful" },
  { name: "neutral", label: "Neutral" },
  { name: "confused", label: "Confused" },
  { name: "angry", label: "Angry" },
];

// Skin and hair share these light-to-dark swatches; only the darkest differs (one
// entry below), so they are spread from a common base to keep them in lockstep.
const PALETTE_BASE: readonly Swatch[] = [
  { name: "White", hex: "FFFFFF" },
  { name: "Mist", hex: "DDF0F4" },
  { name: "Sky", hex: "8FCAD6" },
  { name: "Teal", hex: "2F9BB3" },
  { name: "Deep", hex: "1F6E80" },
];

// Hair can go to the brand near-black (ink-900); skin's darkest is a blue-tinted
// teal-dark instead, because the eyes render in black and would vanish against a
// near-black face.
const SKINS: readonly Swatch[] = [
  ...PALETTE_BASE,
  { name: "Ink", hex: "16505C" },
];
const HAIR_COLORS: readonly Swatch[] = [
  ...PALETTE_BASE,
  { name: "Ink", hex: "1B1B2F" },
];

// Clean-shaven or a beard (Dylan has a single beard style).
const BEARDS: readonly { label: string }[] = [
  { label: "No beard" },
  { label: "Beard" },
];

// The background is picked automatically to contrast with the skin and hair, so a
// light avatar gets the deep tint and a dark one gets the pale tint. Both are
// on-brand (teal-50 and teal-700).
const BACKGROUNDS = ["EEF8FA", "1F6E80"] as const;

// WCAG relative luminance of a 6-digit hex (no '#').
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Choose the background that maximizes the weaker of its two contrasts (against
// skin and against hair), so neither part of the avatar blends into it.
function backgroundFor(skinHex: string, hairHex: string): string {
  let best: string = BACKGROUNDS[0];
  let bestScore = -1;
  for (const bg of BACKGROUNDS) {
    const score = Math.min(
      contrastRatio(bg, skinHex),
      contrastRatio(bg, hairHex),
    );
    if (score > bestScore) {
      bestScore = score;
      best = bg;
    }
  }
  return best;
}

export interface AvatarParts {
  hairs: readonly string[];
  moods: readonly string[];
  skins: readonly string[];
  hairColors: readonly string[];
  beards: readonly string[];
  // CSS colors (with leading '#') so the builder can show color rows as plain
  // swatches instead of full avatars.
  skinHexes: readonly string[];
  hairColorHexes: readonly string[];
  // Per-hair flag: a bald style ignores the hair color, so the builder can dim the
  // hair-color row when one is selected.
  hairIsBald: readonly boolean[];
}

// The builder needs the option labels, counts, and color values; it builds configs
// by index.
export const avatarParts: AvatarParts = {
  hairs: HAIR.map((h) => h.label),
  moods: MOODS.map((m) => m.label),
  skins: SKINS.map((p) => p.name),
  hairColors: HAIR_COLORS.map((p) => p.name),
  beards: BEARDS.map((b) => b.label),
  skinHexes: SKINS.map((p) => `#${p.hex}`),
  hairColorHexes: HAIR_COLORS.map((p) => `#${p.hex}`),
  hairIsBald: HAIR.map((h) => h.bald === true),
};

// A fresh account starts here: plain hair, happy, teal skin, ink hair, no beard.
export const DEFAULT_AVATAR: AvatarConfig = {
  hair: 0,
  mood: 0,
  skin: 3,
  hairColor: 5,
  beard: 0,
};

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
    inRange(c.skin, SKINS.length) &&
    inRange(c.hairColor, HAIR_COLORS.length) &&
    inRange(c.beard, BEARDS.length)
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

// Clamp an arbitrary number into [0, n) by true modulo: plain `%` keeps the sign,
// so a negative index would survive (and only be rescued by a later `?? [0]`).
function wrapIndex(v: number, n: number): number {
  return ((Math.trunc(v) % n) + n) % n;
}

function normalize(cfg: AvatarConfigInput): AvatarConfig {
  if (typeof cfg === "number") return randomAvatar(cfg);
  const c = cfg ?? {};
  return {
    hair: wrapIndex(c.hair ?? 0, HAIR.length),
    mood: wrapIndex(c.mood ?? 0, MOODS.length),
    skin: wrapIndex(c.skin ?? 0, SKINS.length),
    hairColor: wrapIndex(c.hairColor ?? 0, HAIR_COLORS.length),
    beard: wrapIndex(c.beard ?? 0, BEARDS.length),
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
  const skin = SKINS[cfg.skin] ?? SKINS[0];
  const hairCol = HAIR_COLORS[cfg.hairColor] ?? HAIR_COLORS[0];
  if (!hair || !mood || !skin || !hairCol) {
    throw new Error("avatarSvg: config index out of range");
  }
  // Bald forces the hair color to the skin so the (flat) hair blends into the head;
  // otherwise the chosen hair color applies.
  const hairHex = hair.bald ? skin.hex : hairCol.hex;
  return createAvatar(STYLE, {
    seed: AVATAR_SEED,
    // Single-element arrays force the exact choice (DiceBear otherwise picks from
    // the list by seed).
    hair: [hair.name],
    mood: [mood.name],
    skinColor: [skin.hex],
    hairColor: [hairHex],
    backgroundColor: [backgroundFor(skin.hex, hairHex)],
    facialHair: ["default"],
    facialHairProbability: cfg.beard > 0 ? 100 : 0,
  }).toString();
}

// Generated avatars are pure in their config, so memoize the data URIs. The config
// space is ~5.6k but a builder session or a roster touches far fewer; a small bound
// keeps memory flat while collapsing the repeated re-renders to one generation each.
const svgCache = new Map<string, string>();
const SVG_CACHE_MAX = 512;

export function avatarSrc(cfg: AvatarConfigInput): string {
  const c = normalize(cfg);
  const key = `${c.hair}:${c.mood}:${c.skin}:${c.hairColor}:${c.beard}`;
  const cached = svgCache.get(key);
  if (cached !== undefined) return cached;
  const src = "data:image/svg+xml," + encodeURIComponent(avatarSvg(c));
  if (svgCache.size >= SVG_CACHE_MAX) {
    const oldest = svgCache.keys().next().value;
    if (oldest !== undefined) svgCache.delete(oldest);
  }
  svgCache.set(key, src);
  return src;
}

export function randomAvatar(seed: number): AvatarConfig {
  // Avalanche the seed (xorshift-multiply, same family as pseudonymFor) so even
  // adjacent seeds spread across the whole space. Each field is a successive "digit"
  // of the mixed value via division, not low-bit modulo, which would cluster.
  let h = seed >>> 0 || 1;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const H = HAIR.length;
  const M = MOODS.length;
  const S = SKINS.length;
  const C = HAIR_COLORS.length;
  return {
    hair: h % H,
    mood: Math.floor(h / H) % M,
    skin: Math.floor(h / (H * M)) % S,
    hairColor: Math.floor(h / (H * M * S)) % C,
    beard: Math.floor(h / (H * M * S * C)) % BEARDS.length,
  };
}

/**
 * The default face for an alias with no chosen avatar (doc 19). Seeds on the alias's
 * opaque id (`seed`), NOT the handle: the handle can be user-chosen and identifying,
 * while the opaque id is random and per-alias, so the derived face reveals nothing
 * and the same id always yields the same face. Pure and on-device.
 */
export function avatarFor(seed: string): string {
  let h = 0;
  const str = seed || "";
  for (let i = 0; i < str.length; i++)
    h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  return avatarSrc(randomAvatar(h));
}

// The pseudonym wordlists live in their own data module (they are large and static);
// re-exported here so avatars.ts stays the single public face. See pseudonymWords.ts.
import { PSEUDONYM_ADJECTIVES, PSEUDONYM_NOUNS } from "./pseudonymWords.ts";
export { PSEUDONYM_ADJECTIVES, PSEUDONYM_NOUNS };

/**
 * A deterministic, id-derived display handle for an alias with no chosen handle
 * (doc 15). The same id always yields the same `adjective_noun_NN`, distinct ids
 * differ, and it reveals nothing because the id is random per alias. With 256
 * adjectives and 256 nouns the word pair alone is the separator (~65k pairs, the
 * ~10^5 order doc 15 asks for), and the two-digit suffix lifts the full space to
 * ~6.5M (256 x 256 x 100), so collisions across one owner's aliases stay rare and a
 * shared word pair (a correlation hint) is rarer still. Output is in the handle
 * charset, well under the 64-char cap.
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
  // Each field reads a DISJOINT byte of the avalanched hash, so the adjective, noun,
  // and suffix are independent: with 256 of each, both lists are indexed uniformly
  // (a full byte, no modulo bias) and two ids share an adjective_noun pair only by a
  // 1-in-65536 chance, well under the per-owner collision budget (doc 15).
  const adj = PSEUDONYM_ADJECTIVES[h & 0xff] ?? "swift";
  const noun = PSEUDONYM_NOUNS[(h >>> 8) & 0xff] ?? "river";
  const num = String(((h >>> 16) & 0xffff) % 100).padStart(2, "0");
  return `${adj}_${noun}_${num}`;
}
