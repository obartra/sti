// The deploy config (doc 22) is an executable invariant: the service worker must be
// served no-store so a new sw.js is fetched on every visit and a deploy takes effect
// at once. A stale sw.js would pin the old app, so this is a test, not a doc note.
// The netlify.toml lives at the repo root; vitest runs with the passport root as
// cwd, so resolve one level up (like manifest.test.ts resolves files from cwd).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const netlifyToml = readFileSync(
  resolve(process.cwd(), "..", "netlify.toml"),
  "utf8",
);

// A minimal TOML header-block reader: find the `[[headers]]` block whose `for`
// matches, then read its `Cache-Control` value. Avoids a TOML dependency; the
// format here is simple and stable.
function cacheControlFor(path: string): string | null {
  const blocks = netlifyToml.split(/\[\[headers\]\]/);
  for (const block of blocks) {
    const forMatch = /^\s*for\s*=\s*"([^"]+)"/m.exec(block);
    if (forMatch?.[1] !== path) continue;
    const cc = /Cache-Control\s*=\s*"([^"]+)"/.exec(block);
    return cc?.[1] ?? null;
  }
  return null;
}

describe("netlify deploy headers (doc 22)", () => {
  it("serves /sw.js no-store so a deploy is never pinned by a stale worker", () => {
    expect(cacheControlFor("/sw.js")).toBe("no-store");
  });

  it("still revalidates the app shell (the existing index.html rule)", () => {
    // A sibling assertion so a refactor that drops the shell rule fails too.
    expect(cacheControlFor("/index.html")).toBe(
      "public, max-age=0, must-revalidate",
    );
  });
});
