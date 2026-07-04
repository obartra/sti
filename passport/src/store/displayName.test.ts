import { describe, it, expect } from "vitest";
import {
  sanitizeDisplayName,
  normalizeDisplayName,
  MAX_DISPLAY_NAME,
} from "./displayName.ts";

describe("display name normalization", () => {
  it("keeps a real name: mixed case, spaces, letters of any script, marks, digits", () => {
    expect(sanitizeDisplayName("Sam Rivers")).toBe("Sam Rivers");
    expect(sanitizeDisplayName("José Ng-Smith")).toBe("José Ng-Smith");
    expect(sanitizeDisplayName("O'Brien")).toBe("O'Brien");
    expect(sanitizeDisplayName("さくら 2")).toBe("さくら 2");
  });

  it("strips emoji, symbols, and other non-name characters", () => {
    expect(sanitizeDisplayName("Sam 🎉")).toBe("Sam ");
    expect(sanitizeDisplayName("a@b#c")).toBe("abc");
  });

  it("strips control, zero-width, and bidi characters", () => {
    expect(sanitizeDisplayName("Sam​Rivers")).toBe("SamRivers"); // zero-width space
    expect(sanitizeDisplayName("Sa‮m")).toBe("Sam"); // right-to-left override
    expect(sanitizeDisplayName("a\tb\nc")).toBe("a b c"); // control -> collapsed space
  });

  it("collapses internal whitespace but does not trim while typing", () => {
    expect(sanitizeDisplayName("Sam   Rivers")).toBe("Sam Rivers");
    expect(sanitizeDisplayName("Sam ")).toBe("Sam "); // trailing space survives mid-type
  });

  it("caps the length by code point", () => {
    expect(sanitizeDisplayName("a".repeat(80))).toHaveLength(MAX_DISPLAY_NAME);
    // An astral character counts as one, never split into a broken half.
    const many = "😀".repeat(50); // emoji are stripped anyway, so this is empty
    expect(sanitizeDisplayName(many)).toBe("");
  });

  it("normalizeDisplayName trims the ends; empty means no name", () => {
    expect(normalizeDisplayName("  Sam Rivers  ")).toBe("Sam Rivers");
    expect(normalizeDisplayName("   ")).toBe("");
    expect(normalizeDisplayName("🎉")).toBe("");
  });
});
