import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  normalizeVanityName,
  vanityNameError,
  isValidVanityName,
  RESERVED_NAMES,
  MIN_VANITY_LEN,
  MAX_VANITY_LEN,
} from "./vanityName.ts";

describe("normalizeVanityName", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeVanityName("  Robin\n")).toBe("robin");
    expect(normalizeVanityName("USER_42")).toBe("user_42");
  });
});

describe("vanityNameError", () => {
  it("accepts a well-formed name (letters, digits, underscore)", () => {
    expect(vanityNameError("robin")).toBeNull();
    expect(vanityNameError("user_42")).toBeNull();
    expect(vanityNameError("a_b_c")).toBeNull();
  });

  it("normalizes before judging (case-folded, trimmed)", () => {
    expect(vanityNameError("  RoBiN ")).toBeNull();
    // ...and a reserved word is caught regardless of case/whitespace.
    expect(vanityNameError("  ADMIN ")).toBe("reserved");
  });

  it("enforces the length bounds", () => {
    expect(vanityNameError("a".repeat(MIN_VANITY_LEN - 1))).toBe("too-short");
    expect(vanityNameError("a".repeat(MIN_VANITY_LEN))).toBeNull();
    expect(vanityNameError("a".repeat(MAX_VANITY_LEN))).toBeNull();
    expect(vanityNameError("a".repeat(MAX_VANITY_LEN + 1))).toBe("too-long");
  });

  it("rejects anything outside [a-z0-9_] (no hyphen, space, dot, Unicode)", () => {
    expect(vanityNameError("rob-in")).toBe("bad-chars");
    expect(vanityNameError("rob in")).toBe("bad-chars");
    expect(vanityNameError("rob.in")).toBe("bad-chars");
    expect(vanityNameError("robín")).toBe("bad-chars"); // accented / Unicode
    expect(vanityNameError("rob!n")).toBe("bad-chars");
  });

  it("rejects reserved operational / brand terms", () => {
    for (const name of ["admin", "sticare", "support", "official", "sti"]) {
      expect(vanityNameError(name)).toBe("reserved");
    }
  });
});

describe("isValidVanityName", () => {
  it("is true for claimable names, false otherwise", () => {
    expect(isValidVanityName("robin")).toBe(true);
    expect(isValidVanityName("ab")).toBe(false); // too short
    expect(isValidVanityName("admin")).toBe(false); // reserved
    expect(isValidVanityName("rob in")).toBe(false); // bad chars
  });

  const charChars = "abcdefghijklmnopqrstuvwxyz0123456789_".split("");
  const charUnit = fc.constantFrom(...charChars);

  it("property: any [a-z0-9_] string of valid length that is not reserved is claimable", () => {
    fc.assert(
      fc.property(
        fc.string({
          unit: charUnit,
          minLength: MIN_VANITY_LEN,
          maxLength: MAX_VANITY_LEN,
        }),
        (name) => {
          const expected = !RESERVED_NAMES.has(name);
          return isValidVanityName(name) === expected;
        },
      ),
    );
  });

  it("property: an out-of-charset character anywhere in the name blocks it", () => {
    const valid = fc.string({
      unit: charUnit,
      minLength: MIN_VANITY_LEN,
      maxLength: 12,
    });
    fc.assert(
      fc.property(
        valid,
        valid,
        fc.constantFrom("-", " ", ".", "!", "/", "é"),
        (left, right, bad) => {
          // Flank the bad char with valid chars so normalization (trim) cannot
          // drop it; it must then fail the charset gate.
          return !isValidVanityName(left + bad + right);
        },
      ),
    );
  });
});
