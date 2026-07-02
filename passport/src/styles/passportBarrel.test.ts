import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// styles/passport.css is the app's barrel over the vendored design system: the
// same imports as design/index.css minus tokens/fonts.css (font loading is
// app-owned). The vendored barrel is read-only and can change under us on a
// design-bundle sync, so pin the relationship: if design/index.css gains,
// loses, or reorders an import, this fails instead of the app silently
// dropping part of the design system.

const read = (rel: string) =>
  readFileSync(join(__dirname, rel), "utf8")
    .split("\n")
    .map((line) => /^@import "(?<path>[^"]+)"/.exec(line)?.groups?.path)
    .filter((p): p is string => Boolean(p));

describe("the skip-fonts barrel", () => {
  it("imports exactly the design barrel's files minus tokens/fonts.css", () => {
    const vendored = read("../design/index.css").filter(
      (p) => p !== "./tokens/fonts.css",
    );
    const app = read("./passport.css").map((p) =>
      p.replace("../design/", "./"),
    );
    expect(app).toEqual(vendored);
  });
});
