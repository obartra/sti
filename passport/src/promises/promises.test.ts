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

// Files CI executes every build: app specs run by `npm run test:cov` /
// `test:integration`, Go tests run by `go test ./...`. A backing test MUST live
// in one of these, so "backed by a test that goes red the moment it breaks" is
// true rather than aspirational.
const APP_TEST = /\.test\.tsx?$/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Why a backing is not a real, build-failing test, or null if it is one. This is
 * what makes the promise honest: it is not enough for the file to mention the
 * name. The name must be an actual declaration CI runs and that is not disabled,
 * so a rename, a delete, a comment-out, or an `.only`/`.skip` fails the build.
 */
function backingError(file: string, name: string): string | null {
  if (!existsSync(resolve(process.cwd(), file))) {
    return `missing test file ${file}`;
  }
  const body = read(file);
  const esc = escapeRegExp(name);
  if (file.endsWith("_test.go")) {
    // A top-level `func TestXxx(`, not a substring in a comment or a string.
    return new RegExp(`(^|\\n)func ${esc}\\(`).test(body)
      ? null
      : `Go test func "${name}" is not declared in ${file}`;
  }
  if (APP_TEST.test(file)) {
    // The name is an it()/test() title (or a substring of one). Capture an
    // optional `.skip`/`.only` so a disabled or focused test is rejected.
    const decl = new RegExp(
      `\\b(?:it|test)(?:\\.(skip|only))?\\s*\\(\\s*['"\`][^'"\`]*${esc}`,
    ).exec(body);
    if (decl === null) {
      return `no it()/test() titled like "${name}" in ${file}`;
    }
    if (decl[1] !== undefined) {
      return `backing test "${name}" is .${decl[1]} (disabled) in ${file}`;
    }
    return null;
  }
  return `backing file ${file} is not a test CI runs (*.test.ts(x) or *_test.go)`;
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
  )(
    "%s: is pinned by a real, un-skipped test CI runs every build",
    (_label, b) => {
      expect(
        backingError(b.backing.file, b.backing.name),
        `promise ${b.promise}`,
      ).toBeNull();
    },
  );

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
