// A tiny local generator for a short, playful private name (e.g. "dr bojangles",
// "sneaky mango", "dynamite"). The name is optional and never shared, so this is
// pure client-side flavor, not an identity anyone can look up. It mixes three
// shapes (bare word, title + word, adjective + word) over decent-sized lists so
// repeats are rare.

const TITLES = [
  "dr",
  "captain",
  "sir",
  "lil",
  "big",
  "professor",
  "agent",
  "chef",
  "major",
  "lady",
  "baron",
  "the",
];

const ADJECTIVES = [
  "sneaky",
  "cosmic",
  "grumpy",
  "velvet",
  "turbo",
  "sleepy",
  "salty",
  "spicy",
  "fuzzy",
  "electric",
  "midnight",
  "rowdy",
  "dapper",
  "feral",
  "lucky",
  "quiet",
  "wobbly",
  "brave",
];

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
  "raccoon",
  "goblin",
  "walrus",
  "pretzel",
  "comet",
  "otter",
  "dumpling",
  "wombat",
  "marbles",
  "nugget",
  "pigeon",
  "burrito",
];

function pick<T>(list: readonly T[]): T {
  // Non-empty lists above, so the index is always in range.
  return list[Math.floor(Math.random() * list.length)] as T;
}

// A short, fun name: about a third of the time a bare word ("dynamite"), a third
// a title plus a word ("captain snacks"), a third an adjective plus a word
// ("sneaky mango"). The three shapes over the lists above give thousands of
// combinations, so the shuffle rarely repeats.
export function funName(): string {
  const word = pick(WORDS);
  const roll = Math.random();
  if (roll < 0.34) return word;
  if (roll < 0.67) return `${pick(TITLES)} ${word}`;
  return `${pick(ADJECTIVES)} ${word}`;
}
