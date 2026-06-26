// @vitest-environment node
//
// The trust copy (doc 22) is user-facing, so it is governed by the voice guide
// (doc 21) and by the honesty rule: it may never say more than the system does.
// This pins both: no banned vocabulary, no em dashes, and the load-bearing honest
// clauses (the contact, the age line, the "not a medical test" framing) stay
// present so a future edit cannot quietly drop them.
import { describe, it, expect } from "vitest";
import {
  PRIVACY_POLICY,
  TERMS,
  TRUST_FOOTER,
  LANDING_PROMISES_LINK,
  type LegalDoc,
} from "./trustCopy.ts";

function stringsOf(doc: LegalDoc): string[] {
  const out = [doc.title, doc.lead, doc.updated];
  for (const block of doc.blocks) {
    out.push(block.heading);
    out.push(...(block.paragraphs ?? []));
    out.push(...(block.bullets ?? []));
  }
  return out;
}

const ALL_STRINGS = [
  ...stringsOf(PRIVACY_POLICY),
  ...stringsOf(TERMS),
  ...Object.values(TRUST_FOOTER),
  LANDING_PROMISES_LINK,
];

describe("trust copy obeys the voice and honesty rules", () => {
  // The voice guide's internal vocabulary, banned from user copy (doc 21).
  const BANNED =
    /\b(alias(es)?|linkups?|knocks?|findable|decoys?|resolv\w*)\b/i;

  it.each(ALL_STRINGS)("is non-empty and jargon-free: %s", (s) => {
    expect(s.trim().length).toBeGreaterThan(0);
    expect(BANNED.test(s), `"${s}" uses banned vocabulary`).toBe(false);
  });

  it("uses no em or en dashes", () => {
    // Checked by code point (em 0x2014, en 0x2013) so this file holds no literal.
    const hasDash = (s: string): boolean => {
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code === 0x2014 || code === 0x2013) return true;
      }
      return false;
    };
    for (const s of ALL_STRINGS) {
      expect(hasDash(s)).toBe(false);
    }
  });

  it("keeps the load-bearing honest clauses", () => {
    const privacy = stringsOf(PRIVACY_POLICY).join("\n");
    expect(privacy).toContain("privacy@sti.care");
    expect(privacy).toContain("18 and over");
    expect(privacy).toMatch(/can't read/i);
    expect(privacy).toMatch(/no analytics/i);

    const terms = stringsOf(TERMS).join("\n");
    expect(terms).toMatch(/not a medical test/i);
    expect(terms).toContain("18 or older");
    expect(terms).toMatch(/as is/i);
  });

  it("every block carries prose or a list, never an empty section", () => {
    for (const doc of [PRIVACY_POLICY, TERMS]) {
      for (const block of doc.blocks) {
        const hasBody =
          (block.paragraphs?.length ?? 0) + (block.bullets?.length ?? 0);
        expect(hasBody, `block "${block.heading}" is empty`).toBeGreaterThan(0);
      }
    }
  });
});
