// @vitest-environment node
//
// The promises CI gate. Every plain-English guarantee on the /promises page must
// stay honestly backed, so this test fails the build when a promise drifts from the
// code that delivers it: a missing test file, a renamed test, a promise with no
// codified backing at all, or empty copy. It is the mechanism that keeps the page
// from ever claiming more than the tests provably deliver.
//
// Test paths in promises.ts are relative to passport/ (this suite's cwd): app tests
// resolve directly, Go tests via `../server/...`.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROMISES, type UserPromise } from "./promises.ts";

const fileCache = new Map<string, string>();
function read(file: string): string {
  const cached = fileCache.get(file);
  if (cached !== undefined) return cached;
  const body = readFileSync(resolve(process.cwd(), file), "utf8");
  fileCache.set(file, body);
  return body;
}

describe("promises page is honestly backed (CI gate)", () => {
  it("has a non-empty, unique set of promises", () => {
    expect(PROMISES.length).toBeGreaterThan(0);
    const ids = PROMISES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // ids are unique
  });

  it.each(PROMISES.map((p) => [p.id, p] as const))(
    "%s: plain + detail copy is present and assertions roll up",
    (_id, promise: UserPromise) => {
      expect(promise.plain.trim().length).toBeGreaterThan(0);
      expect(promise.detail.trim().length).toBeGreaterThan(0);
      expect(promise.assertions.length).toBeGreaterThan(0);
      for (const a of promise.assertions) {
        expect(a.claim.trim().length).toBeGreaterThan(0);
      }
      // No promise may be pure marketing: at least one assertion must be pinned by
      // a real test, not reasoning alone.
      const testBacked = promise.assertions.filter(
        (a) => a.backedBy.kind === "test",
      );
      expect(
        testBacked.length,
        `promise "${promise.id}" has no test-backed assertion`,
      ).toBeGreaterThan(0);
    },
  );

  // Flatten every test backing so a missing/renamed test points at the exact claim.
  const backings = PROMISES.flatMap((p) =>
    p.assertions
      .filter((a) => a.backedBy.kind === "test")
      .map((a) => ({
        promise: p.id,
        claim: a.claim,
        backing: a.backedBy as { kind: "test"; file: string; name: string },
      })),
  );

  it.each(
    backings.map((b) => [`${b.promise} :: ${b.backing.name}`, b] as const),
  )("%s: the backing test exists and contains the named test", (_label, b) => {
    const path = resolve(process.cwd(), b.backing.file);
    expect(existsSync(path), `missing test file ${b.backing.file}`).toBe(true);
    // The named test (an it() title substring, or a Go func name) must really be
    // in that file, so a rename can't leave a promise pointing at nothing.
    expect(
      read(b.backing.file).includes(b.backing.name),
      `"${b.backing.name}" not found in ${b.backing.file} (promise ${b.promise})`,
    ).toBe(true);
  });

  it("every reasoning-only assertion explains why it is not a test", () => {
    for (const p of PROMISES) {
      for (const a of p.assertions) {
        if (a.backedBy.kind === "reasoning") {
          expect(a.backedBy.why.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});
