// A tiny local generator for a short, playful private name (e.g. "dr bojangles",
// "dynamite", "captain snacks"). The name is optional and never shared, so this is
// pure client-side flavor, not an identity anyone can look up. Two shapes: a
// single punchy word, or a title plus a word, kept short and lowercase-friendly.

const TITLES = ["dr", "captain", "sir", "lil", "big", "professor", "agent"];

const WORDS = [
  "bojangles",
  "dynamite",
  "snacks",
  "mango",
  "pickle",
  "thunder",
  "waffles",
  "biscuit",
  "noodle",
  "sparkle",
  "cactus",
  "peanut",
  "tofu",
  "banjo",
  "muffin",
  "gizmo",
  "pepper",
  "cosmo",
];

function pick<T>(list: readonly T[]): T {
  // Non-empty lists above, so the index is always in range.
  return list[Math.floor(Math.random() * list.length)] as T;
}

// A short, fun name. Roughly half the time it is a bare word ("dynamite"), the
// rest a title plus a word ("captain snacks").
export function funName(): string {
  const word = pick(WORDS);
  return Math.random() < 0.5 ? word : `${pick(TITLES)} ${word}`;
}
