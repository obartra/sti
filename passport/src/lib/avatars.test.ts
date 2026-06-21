import { describe, it, expect } from "vitest";
import { pseudonymFor } from "./avatars.ts";
import { randomAliasId } from "../crypto/index.ts";
import { isValidHandle } from "../store/codec.ts";

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
