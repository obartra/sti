import { describe, it, expect } from "vitest";
import {
  gradePassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  REQUIRED_ZXCVBN_SCORE,
} from "./passwordStrength.ts";

describe("gradePassword", () => {
  it("rejects a too-short password before anything else", () => {
    const grade = gradePassword("aB3$x");
    expect(grade.ok).toBe(false);
    if (!grade.ok) expect(grade.reason).toMatch(/at least 10 characters/);
  });

  it("rejects a too-long password", () => {
    const grade = gradePassword("a".repeat(MAX_PASSWORD_LENGTH + 1));
    expect(grade.ok).toBe(false);
    if (!grade.ok) expect(grade.reason).toMatch(/under 128 characters/);
  });

  it("rejects a common password (any case) with a distinct reason", () => {
    // Long enough to clear the length floor, so the wordlist check is what fires.
    const grade = gradePassword("Password123");
    expect(grade.ok).toBe(false);
    if (!grade.ok) expect(grade.reason).toMatch(/most common passwords/);
  });

  it("rejects a long-but-weak password the estimator can see through", () => {
    // Long enough to pass the length floor and not an exact wordlist hit, but a
    // trivial keyboard/sequence pattern the estimator scores low.
    const grade = gradePassword("123456789012");
    expect(grade.ok).toBe(false);
    if (!grade.ok) expect(grade.reason).toMatch(/harder to guess/);
  });

  it("accepts a strong passphrase", () => {
    expect(gradePassword("correct-horse-battery-staple")).toEqual({ ok: true });
  });

  it("accepts a strong random password", () => {
    expect(gradePassword("9f3Kx2-pLm8Qz")).toEqual({ ok: true });
  });

  it("exposes the gate constants as the documented floor", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(MAX_PASSWORD_LENGTH).toBe(128);
    expect(REQUIRED_ZXCVBN_SCORE).toBe(4);
  });

  it("never lectures or describes an attack in its reasons", () => {
    // A light guard on the voice rules (doc 21/32): the reject copy stays plain.
    for (const pw of ["short", "password", "aaaaaaaaaaaa"]) {
      const grade = gradePassword(pw);
      expect(grade.ok).toBe(false);
      if (!grade.ok) {
        expect(grade.reason).not.toMatch(
          /attack|crack|hack|brute|guess attack/i,
        );
        expect(grade.reason.length).toBeLessThan(90);
      }
    }
  });
});
