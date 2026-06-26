import { describe, it, expect } from "vitest";
import {
  selectPrecacheFiles,
  precacheBytes,
  PRECACHE_BUDGET_BYTES,
  type Bundle,
} from "./precachePlugin.ts";

const bundle: Bundle = {
  "index.html": { type: "asset", source: "<html></html>" },
  "assets/app.css": { type: "asset", source: "a{color:red}" },
  "assets/index.js": {
    type: "chunk",
    code: "console.log(1)",
    isDynamicEntry: false,
  },
  // A dynamically-imported chunk (e.g. the QR scanner): excluded from the shell.
  "assets/scanner.js": {
    type: "chunk",
    code: "/* a big dynamic chunk */",
    isDynamicEntry: true,
  },
};

describe("precache plugin (doc 22 slice 2 + N)", () => {
  it("selects the shell (html, css, static chunks) and excludes dynamic chunks", () => {
    expect(selectPrecacheFiles(bundle).sort()).toEqual([
      "assets/app.css",
      "assets/index.js",
      "index.html",
    ]);
  });

  it("sums only the precached files' bytes, within the budget", () => {
    const files = selectPrecacheFiles(bundle);
    const bytes = precacheBytes(bundle, files);
    expect(bytes).toBe(
      "<html></html>".length + "a{color:red}".length + "console.log(1)".length,
    );
    // The dynamic scanner chunk is not counted.
    expect(bytes).toBeLessThan(PRECACHE_BUDGET_BYTES);
  });

  it("a Uint8Array asset source is measured by its byte length", () => {
    const binary: Bundle = {
      "index.html": { type: "asset", source: new Uint8Array([1, 2, 3, 4]) },
    };
    expect(precacheBytes(binary, ["index.html"])).toBe(4);
  });
});
