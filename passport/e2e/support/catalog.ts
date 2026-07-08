// The behaviors-catalog harness every spec file shares (doc 14 §12): tests declare
// the behavior ids they validate, unknown ids throw, and a per-file coverage test
// fails when a behavior pinned to that file has no test (or a test claims a
// behavior pinned elsewhere). Read as data (cwd is passport/), so specs need no
// JSON import-attribute support from Playwright's loader.
import { readFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";

interface Behavior {
  id: string;
  title: string;
  status: string;
  layer: string;
  pin: string;
}

const BEHAVIORS = JSON.parse(
  readFileSync("src/loadlab/behaviors.json", "utf8"),
) as Behavior[];

export interface BehaviorHarness {
  /** Declare + register a test that validates the given behavior id(s). */
  behaviorTest: (
    ids: string | readonly string[],
    fn: (args: { page: Page; browser: Browser }) => Promise<void>,
  ) => void;
  /** Register the meta-test pinning this file's catalog coverage both ways. */
  coverageTest: () => void;
}

export function behaviorHarness(pin: string): BehaviorHarness {
  const covered = new Set<string>();
  const byId = (id: string): Behavior => {
    const b = BEHAVIORS.find((x) => x.id === id);
    if (b === undefined) throw new Error(`unknown behavior id: ${id}`);
    return b;
  };
  return {
    behaviorTest(ids, fn) {
      const list = typeof ids === "string" ? [ids] : ids;
      for (const id of list) {
        byId(id); // throws if the id is not in the catalog
        covered.add(id);
      }
      const titles = list.map((id) => byId(id).title).join(" + ");
      test(`${titles} [${list.join(", ")}]`, fn);
    },
    coverageTest() {
      test("this spec covers every behavior it pins", () => {
        const ownedHere = BEHAVIORS.filter((b) => b.pin === pin);
        for (const b of ownedHere) expect(covered.has(b.id)).toBe(true);
        for (const id of covered) {
          expect(BEHAVIORS.find((b) => b.id === id)?.pin).toBe(pin);
        }
      });
    },
  };
}
