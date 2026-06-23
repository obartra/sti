import { describe, it, expect, vi } from "vitest";
import {
  pseudonymFor,
  avatarFor,
  avatarSrc,
  randomAvatar,
  isAvatarConfig,
  migrateAvatar,
  avatarParts,
  DEFAULT_AVATAR,
  type AvatarConfig,
} from "./avatars.ts";
import { randomAliasId } from "../crypto/index.ts";
import { isValidHandle } from "../store/codec.ts";

// Decode an avatarSrc data URI back to its raw SVG markup.
function svgOf(src: string): string {
  const comma = src.indexOf(",");
  expect(src.slice(0, comma)).toBe("data:image/svg+xml");
  return decodeURIComponent(src.slice(comma + 1));
}

// Every color the avatars are allowed to emit: the brand teal swatches from
// colors.css, white, and the black/none Dylan uses for line detail. Anything else
// would be a default skin/hair color leaking past the tone pinning.
const ALLOWED_HEX = new Set([
  "1f6e80",
  "277f94",
  "2f9bb3",
  "8fcad6",
  "ddf0f4",
  "eef8fa",
  "ffffff",
  "fff",
  "1b1b2f",
]);
const ALLOWED_NAMED = new Set(["black", "white", "none"]);

// Real alias ids: crypto-random 43-char base64url, the actual id distribution.
const ids = Array.from({ length: 1000 }, () => randomAliasId());

describe("pseudonymFor (doc 15 id-derived handle)", () => {
  it("is deterministic: the same id always yields the same handle", () => {
    for (const id of ids.slice(0, 20)) {
      expect(pseudonymFor(id)).toBe(pseudonymFor(id));
    }
  });

  it("emits a valid handle in the adjective_noun_NN charset", () => {
    for (const id of ids) {
      const p = pseudonymFor(id);
      expect(p).toMatch(/^[a-z]+_[a-z]+_\d{2}$/);
      expect(isValidHandle(p)).toBe(true);
    }
  });

  it("collides rarely across distinct ids (the unlinkability separator)", () => {
    const seen = new Set(ids.map(pseudonymFor));
    // 1000 random ids over a ~10^5 space: by the birthday bound only a handful of
    // collisions is expected, so the vast majority stay distinct.
    expect(seen.size).toBeGreaterThan(ids.length * 0.97);
  });
});

describe("avatar rendering (doc 19 DiceBear Dylan)", () => {
  it("is deterministic: the same id and config always render identically", () => {
    for (const id of ids.slice(0, 20)) {
      expect(avatarFor(id)).toBe(avatarFor(id));
    }
    const cfg: AvatarConfig = {
      hair: 4,
      mood: 1,
      skin: 2,
      hairColor: 5,
      beard: 1,
    };
    expect(avatarSrc(cfg)).toBe(avatarSrc(cfg));
    expect(avatarSrc(7)).toBe(avatarSrc(7));
  });

  it("distinct ids render distinct avatars", () => {
    const srcs = new Set(ids.map(avatarFor));
    // 1000 ids over a 13 x 7 x 6 x 6 x 2 (=6552) config space: by the birthday
    // bound ~900 stay distinct (mean), so a conservative floor is robust to run
    // variance while still proving broad spread.
    expect(srcs.size).toBeGreaterThan(820);
  });

  it("emits a data:image/svg+xml URI", () => {
    expect(avatarSrc(DEFAULT_AVATAR)).toMatch(/^data:image\/svg\+xml,/);
    expect(svgOf(avatarSrc(DEFAULT_AVATAR)).startsWith("<svg")).toBe(true);
  });

  it("uses only on-brand colors across every option", () => {
    const check = (cfg: AvatarConfig) => {
      const svg = svgOf(avatarSrc(cfg));
      const hexes = svg.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g) ?? [];
      for (const h of hexes) {
        expect(ALLOWED_HEX.has(h.slice(1).toLowerCase())).toBe(true);
      }
      const named =
        svg
          .match(/(?:fill|stroke)="([a-z]+)"/g)
          ?.map((m) => m.replace(/.*"([a-z]+)"/, "$1")) ?? [];
      for (const n of named) {
        expect(ALLOWED_NAMED.has(n)).toBe(true);
      }
    };
    // Every skin x hair-color pairing (the color surface), then every hair style
    // (incl. Bald), mood, and beard with default colors.
    const base = DEFAULT_AVATAR;
    for (let skin = 0; skin < avatarParts.skins.length; skin++)
      for (let hairColor = 0; hairColor < avatarParts.hairColors.length; hairColor++)
        check({ ...base, skin, hairColor });
    for (let hair = 0; hair < avatarParts.hairs.length; hair++)
      for (let beard = 0; beard < avatarParts.beards.length; beard++)
        check({ ...base, hair, beard });
    for (let mood = 0; mood < avatarParts.moods.length; mood++)
      check({ ...base, mood });
  });

  it("never touches the network (generation is fully on-device)", () => {
    const fetchSpy =
      typeof globalThis.fetch === "function"
        ? vi.spyOn(globalThis, "fetch")
        : null;
    avatarFor("robin");
    avatarSrc({ hair: 2, mood: 3, skin: 1, hairColor: 4, beard: 0 });
    avatarSrc(99);
    if (fetchSpy) {
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    }
  });
});

describe("avatar config validation and migration (doc 19)", () => {
  it("accepts a valid in-range config", () => {
    expect(isAvatarConfig(DEFAULT_AVATAR)).toBe(true);
    // hair 12 is Bald (the last index), skin/hairColor 5 is Ink, beard 1.
    expect(
      isAvatarConfig({ hair: 12, mood: 6, skin: 5, hairColor: 5, beard: 1 }),
    ).toBe(true);
  });

  it("rejects out-of-range, partial, wrong-type, and old-shape configs", () => {
    const ok = { hair: 0, mood: 0, skin: 0, hairColor: 0, beard: 0 };
    expect(isAvatarConfig({ ...ok, hair: 13 })).toBe(false);
    expect(isAvatarConfig({ ...ok, skin: 6 })).toBe(false);
    expect(isAvatarConfig({ ...ok, beard: 2 })).toBe(false);
    expect(isAvatarConfig({ ...ok, hairColor: -1 })).toBe(false);
    expect(isAvatarConfig({ ...ok, hair: 1.5 })).toBe(false);
    // Missing the new color/beard fields (the interim { hair, mood, tone } shape).
    expect(isAvatarConfig({ hair: 0, mood: 0, tone: 0 })).toBe(false);
    // The original animal/color/hat/glasses/extra shape.
    expect(
      isAvatarConfig({ animal: 2, color: 1, hat: 0, glasses: 0, extra: 0 }),
    ).toBe(false);
    expect(isAvatarConfig(null)).toBe(false);
    expect(isAvatarConfig("x")).toBe(false);
  });

  it("migrates anything invalid to the default, valid configs pass through", () => {
    const valid: AvatarConfig = {
      hair: 3,
      mood: 2,
      skin: 1,
      hairColor: 4,
      beard: 0,
    };
    expect(migrateAvatar(valid)).toBe(valid);
    // Original shape, the interim tone shape, partial, and corrupt all fall back.
    expect(
      migrateAvatar({ animal: 2, color: 1, hat: 0, glasses: 0, extra: 0 }),
    ).toEqual(DEFAULT_AVATAR);
    expect(migrateAvatar({ hair: 0, mood: 0, tone: 0 })).toEqual(DEFAULT_AVATAR);
    expect(migrateAvatar({ hair: 99 })).toEqual(DEFAULT_AVATAR);
    expect(migrateAvatar(undefined)).toEqual(DEFAULT_AVATAR);
    expect(migrateAvatar("garbage")).toEqual(DEFAULT_AVATAR);
  });

  it("randomAvatar always produces a valid config", () => {
    for (let s = 1; s < 200; s++) {
      expect(isAvatarConfig(randomAvatar(s))).toBe(true);
    }
  });
});
