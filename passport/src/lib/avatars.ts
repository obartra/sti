/* Avatar builder: layered animal avatars with per-animal ANCHORS so
   accessories always land in the right place (frog eyes are on stalks, bunny
   hat sits between the ears, and so on).
   No photos by design, fun without PHI pressure.
   API: avatarParts, avatarSrc(cfgOrSeed), avatarFor(handle), randomAvatar(seed)

   Faithful port of comps-reference/app/avatars.js: same behavior, same
   byte-identical SVG path strings. The original IIFE attached its API to
   window.STI; here it is plain ES module exports with no global references. */

// A color triple is [bg, head, dark].
export type ColorTriple = readonly [string, string, string];

// Anchors: eyes [[x,y],[x,y]] · hatY (where the hat's base sits) ·
// ear [x,y] (earring) · nose [x,y] (stud) · cheek [x,y] (tattoo)
export interface Anchors {
  eyes: readonly [readonly [number, number], readonly [number, number]];
  hatY: number;
  ear: readonly [number, number];
  nose: readonly [number, number];
  cheek: readonly [number, number];
}

export interface Animal {
  name: string;
  anchors: Anchors;
  draw: (h: string, d: string) => string;
}

export interface Accessory {
  name: string;
  draw: (h: string, d: string, a: Anchors) => string;
}

export interface AvatarConfig {
  animal: number;
  color: number;
  hat: number;
  glasses: number;
  extra: number;
}

export type AvatarConfigInput =
  | number
  | Partial<AvatarConfig>
  | null
  | undefined;

export interface AvatarParts {
  animals: readonly Animal[];
  colors: readonly ColorTriple[];
  hats: readonly Accessory[];
  glasses: readonly Accessory[];
  extras: readonly Accessory[];
}

// [bg, head, dark]
const COLORS: readonly ColorTriple[] = [
  ["#DFF1F5", "#2F9BB3", "#16505C"], // teal
  ["#F3ECDF", "#C29A55", "#6B5226"], // sand
  ["#E4F2E9", "#5FAE85", "#2A5E45"], // green
  ["#FAEEDC", "#E0A500", "#7A5A00"], // amber
  ["#E7E9F4", "#7B89C9", "#39406E"], // ink blue
];

const ANIMALS: readonly Animal[] = [
  {
    name: "Cat",
    anchors: {
      eyes: [
        [25.5, 34],
        [38.5, 34],
      ],
      hatY: 18,
      ear: [16.5, 42],
      nose: [32, 40],
      cheek: [44, 43],
    },
    draw: (h, d) => `
      <path d="M17 26 L14 12 L26 20 Z" fill="${h}"/><path d="M47 26 L50 12 L38 20 Z" fill="${h}"/>
      <circle cx="32" cy="37" r="17" fill="${h}"/>
      <circle cx="25.5" cy="34" r="2.4" fill="${d}"/><circle cx="38.5" cy="34" r="2.4" fill="${d}"/>
      <path d="M28 43 q4 3.4 8 0" stroke="${d}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M14 38 l8 1 M14 44 l8-1 M50 38 l-8 1 M50 44 l-8-1" stroke="${d}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`,
  },
  {
    name: "Bear",
    anchors: {
      eyes: [
        [25.5, 34],
        [38.5, 34],
      ],
      hatY: 19,
      ear: [14.5, 43],
      nose: [34.8, 44.6],
      cheek: [44.5, 43.5],
    },
    draw: (h, d) => `
      <circle cx="18" cy="22" r="7" fill="${h}"/><circle cx="46" cy="22" r="7" fill="${h}"/>
      <circle cx="32" cy="38" r="17" fill="${h}"/>
      <circle cx="25.5" cy="34" r="2.4" fill="${d}"/><circle cx="38.5" cy="34" r="2.4" fill="${d}"/>
      <ellipse cx="32" cy="43" rx="6.5" ry="5" fill="#FFFFFF" opacity="0.85"/>
      <circle cx="32" cy="41.5" r="2.2" fill="${d}"/><path d="M32 43.5 v2.5" stroke="${d}" stroke-width="1.8" stroke-linecap="round"/>`,
  },
  {
    name: "Fox",
    anchors: {
      eyes: [
        [25, 33],
        [39, 33],
      ],
      hatY: 18,
      ear: [15.5, 41],
      nose: [34.6, 47.2],
      cheek: [45, 39],
    },
    draw: (h, d) => `
      <path d="M15 30 L12 12 L28 21 Z" fill="${h}"/><path d="M49 30 L52 12 L36 21 Z" fill="${h}"/>
      <circle cx="32" cy="37" r="17" fill="${h}"/>
      <path d="M32 54 q-12-2-15-12 q6-3 15-3 q9 0 15 3 q-3 10-15 12 Z" fill="#FFFFFF" opacity="0.85"/>
      <circle cx="25" cy="33" r="2.4" fill="${d}"/><circle cx="39" cy="33" r="2.4" fill="${d}"/>
      <circle cx="32" cy="45" r="2.6" fill="${d}"/>`,
  },
  {
    name: "Frog",
    anchors: {
      eyes: [
        [22, 22],
        [42, 22],
      ],
      hatY: 8,
      ear: [14.5, 45],
      nose: [34.4, 36.5],
      cheek: [44, 47],
    },
    draw: (h, d) => `
      <circle cx="22" cy="22" r="7.5" fill="${h}"/><circle cx="42" cy="22" r="7.5" fill="${h}"/>
      <circle cx="22" cy="22" r="3" fill="#FFFFFF"/><circle cx="42" cy="22" r="3" fill="#FFFFFF"/>
      <circle cx="22" cy="22" r="1.5" fill="${d}"/><circle cx="42" cy="22" r="1.5" fill="${d}"/>
      <ellipse cx="32" cy="40" rx="18" ry="14.5" fill="${h}"/>
      <path d="M24 43 q8 6 16 0" stroke="${d}" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  },
  {
    name: "Bunny",
    anchors: {
      eyes: [
        [26, 35],
        [38, 35],
      ],
      hatY: 13,
      ear: [17.5, 43],
      nose: [34.2, 39.5],
      cheek: [43.5, 44],
    },
    draw: (h, d) => `
      <ellipse cx="24" cy="14" rx="5.5" ry="12" fill="${h}"/><ellipse cx="40" cy="14" rx="5.5" ry="12" fill="${h}"/>
      <circle cx="32" cy="38" r="16.5" fill="${h}"/>
      <circle cx="26" cy="35" r="2.4" fill="${d}"/><circle cx="38" cy="35" r="2.4" fill="${d}"/>
      <path d="M29.5 43 q2.5 2.6 5 0" stroke="${d}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <circle cx="32" cy="41" r="1.8" fill="${d}"/>`,
  },
  {
    name: "Owl",
    anchors: {
      eyes: [
        [25, 35],
        [39, 35],
      ],
      hatY: 18,
      ear: [15.5, 43],
      nose: [34.6, 44],
      cheek: [45, 43],
    },
    draw: (h, d) => `
      <path d="M18 24 L15 14 L26 19 Z" fill="${h}"/><path d="M46 24 L49 14 L38 19 Z" fill="${h}"/>
      <circle cx="32" cy="38" r="17" fill="${h}"/>
      <circle cx="25" cy="35" r="6" fill="#FFFFFF" opacity="0.9"/><circle cx="39" cy="35" r="6" fill="#FFFFFF" opacity="0.9"/>
      <circle cx="25" cy="35" r="2.6" fill="${d}"/><circle cx="39" cy="35" r="2.6" fill="${d}"/>
      <path d="M32 41 l-3 5 h6 Z" fill="${d}"/>`,
  },
];

// Accessories receive (head, dark, anchors) and draw at the anchor points.
const HATS: readonly Accessory[] = [
  { name: "None", draw: () => "" },
  {
    name: "Beanie",
    draw: (_h, d, a) => {
      const y = a.hatY;
      return `<path d="M19 ${y + 9} q13-15 26 0 l-1 4 q-12-6-24 0 Z" fill="${d}"/>
        <circle cx="32" cy="${y - 3}" r="3.2" fill="${d}"/>`;
    },
  },
  {
    name: "Cap",
    draw: (_h, d, a) => {
      const y = a.hatY;
      return `<path d="M20 ${y + 8} q12-13 24 0 l0 3 q-12-5-24 0 Z" fill="${d}"/>
        <path d="M42 ${y + 8} q9 0 11 5 q-6 1-12-1 Z" fill="${d}"/>`;
    },
  },
  {
    name: "Party",
    draw: (_h, d, a) => {
      const y = a.hatY;
      return `<path d="M32 ${y - 9} L25 ${y + 9} q7-3.5 14 0 Z" fill="${d}"/>
        <circle cx="32" cy="${y - 9}" r="2.8" fill="#E0A500"/>
        <circle cx="29.6" cy="${y + 1}" r="1.3" fill="#FFFFFF" opacity="0.8"/><circle cx="33.8" cy="${y - 3}" r="1.3" fill="#FFFFFF" opacity="0.8"/>`;
    },
  },
];

const GLASSES: readonly Accessory[] = [
  { name: "None", draw: () => "" },
  {
    name: "Round",
    draw: (_h, d, a) => {
      const [[x1, y1], [x2, y2]] = a.eyes;
      return `<circle cx="${x1}" cy="${y1}" r="5.5" stroke="${d}" stroke-width="2" fill="none"/>
        <circle cx="${x2}" cy="${y2}" r="5.5" stroke="${d}" stroke-width="2" fill="none"/>
        <path d="M${x1 + 5.5} ${y1} L${x2 - 5.5} ${y2}" stroke="${d}" stroke-width="2"/>`;
    },
  },
  {
    name: "Shades",
    draw: (_h, d, a) => {
      const [[x1, y1], [x2, y2]] = a.eyes;
      const lens = (x: number, y: number) =>
        `<path d="M${x - 7} ${y - 3.4} h14 v2.4 q0 6-7 6 q-7 0-7-6 Z" fill="${d}" opacity="0.92"/>`;
      const by = (y1 + y2) / 2 - 3.4;
      return (
        lens(x1, y1) +
        lens(x2, y2) +
        `<rect x="${x1 + 6}" y="${by}" width="${Math.max(2, x2 - x1 - 12)}" height="2.2" fill="${d}" opacity="0.92"/>`
      );
    },
  },
];

// Extras (piercings/tattoos) were cut for simplicity, kept here only so
// legacy persisted configs normalize cleanly; never drawn or offered.
const EXTRAS: readonly Accessory[] = [{ name: "None", draw: () => "" }];

const PARTS: AvatarParts = {
  animals: ANIMALS,
  colors: COLORS,
  hats: HATS,
  glasses: GLASSES,
  extras: EXTRAS,
};

export const avatarParts: AvatarParts = PARTS;

// The first option of every layer: a plain animal, used as the default avatar a
// fresh account starts with until the owner customizes it.
export const DEFAULT_AVATAR: AvatarConfig = {
  animal: 0,
  color: 0,
  hat: 0,
  glasses: 0,
  extra: 0,
};

/**
 * Strict validation for a persisted AvatarConfig (the synced account blob): every
 * field must be an in-range integer index. Unlike {@link normalize} (which is
 * lenient for legacy/partial configs at render time) this fails closed, so a
 * corrupt blob is rejected rather than silently coerced.
 */
export function isAvatarConfig(x: unknown): x is AvatarConfig {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  const inRange = (v: unknown, n: number): boolean =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n;
  return (
    inRange(c.animal, ANIMALS.length) &&
    inRange(c.color, COLORS.length) &&
    inRange(c.hat, HATS.length) &&
    inRange(c.glasses, GLASSES.length) &&
    inRange(c.extra, EXTRAS.length)
  );
}

function normalize(cfg: AvatarConfigInput): AvatarConfig {
  if (typeof cfg === "number") return randomAvatar(cfg);
  const c = cfg ?? {};
  return {
    animal: (c.animal ?? 0) % ANIMALS.length,
    color: (c.color ?? 0) % COLORS.length,
    hat: (c.hat ?? 0) % HATS.length,
    glasses: (c.glasses ?? 0) % GLASSES.length,
    extra: (c.extra ?? 0) % EXTRAS.length,
  };
}

function avatarSvg(cfgIn: AvatarConfigInput): string {
  const cfg = normalize(cfgIn);
  const color = COLORS[cfg.color];
  const animal = ANIMALS[cfg.animal];
  const glasses = GLASSES[cfg.glasses];
  const hat = HATS[cfg.hat];
  const extra = EXTRAS[cfg.extra];
  if (!color || !animal || !glasses || !hat || !extra) {
    throw new Error("avatarSvg: config index out of range");
  }
  const [bg, head, dark] = color;
  const a = animal.anchors;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${bg}"/>` +
    animal.draw(head, dark) +
    glasses.draw(head, dark, a) +
    hat.draw(head, dark, a) +
    extra.draw(head, dark, a) +
    `</svg>`
  );
}

export function avatarSrc(cfg: AvatarConfigInput): string {
  return "data:image/svg+xml," + encodeURIComponent(avatarSvg(cfg));
}

export function randomAvatar(seed: number): AvatarConfig {
  let s = seed >>> 0 || 1;
  const next = (n: number) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s % n;
  };
  return {
    animal: next(ANIMALS.length),
    color: next(COLORS.length),
    hat: next(HATS.length),
    glasses: next(GLASSES.length),
    extra: 0,
  };
}

export function avatarFor(handle: string): string {
  let h = 0;
  const str = handle || "";
  for (let i = 0; i < str.length; i++)
    h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  return avatarSrc(randomAvatar(h));
}
