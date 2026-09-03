import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The app chrome only stays put because of how the frames are sized: each
// top-level frame is bounded by the viewport and the scrolling happens in an
// inner pane. Lose that and a long screen makes the document itself scroll,
// which carries the top bar, tab bar and back bar off with the content (worst
// in the installed app, where no browser chrome hides it). CSS layout is not
// something jsdom can compute, so pin the declarations that carry the rule.

const COMMENTS = /\/\*[\s\S]*?\*\//g;

/** The declarations for one selector in a stylesheet, as prop -> last value. */
function rule(file: string, selector: string): Record<string, string> {
  const css = readFileSync(join(__dirname, file), "utf8").replace(COMMENTS, "");
  const out: Record<string, string> = {};
  for (const block of css.matchAll(/(?<sel>[^{}]+)\{(?<body>[^{}]*)\}/g)) {
    const selectors = (block.groups?.sel ?? "").split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    for (const decl of (block.groups?.body ?? "").split(";")) {
      const [prop, ...rest] = decl.split(":");
      if (prop === undefined || rest.length === 0) continue;
      out[prop.trim()] = rest.join(":").trim();
    }
  }
  return out;
}

describe("the document frame", () => {
  it("never scrolls: every frame is viewport-sized and scrolls inside", () => {
    expect(rule("./document.css", "html").overflow).toBe("hidden");
    expect(rule("./document.css", "body").overflow).toBe("hidden");
  });
});

describe("the mobile app frame", () => {
  const shell = "../ui/shell/app-shell.css";

  it("is exactly the viewport tall, so the bars are always on screen", () => {
    const frame = rule(shell, ".app-shell");
    // A min-height would let a tall screen grow the column past the viewport
    // and hand the scroll to the document, bars included.
    expect(frame["min-height"]).toBeUndefined();
    expect(frame.height).toMatch(/100dvh/);
  });

  it("scrolls in the content pane between the bars", () => {
    const content = rule(shell, ".app-shell__content");
    expect(content["overflow-y"]).toBe("auto");
    expect(content["min-height"]).toBe("0"); // or the pane refuses to shrink
  });
});

describe("the sub-screen frame", () => {
  it("pins the back bar and scrolls the body under it", () => {
    expect(rule("./layout.css", ".l-surface--column").overflow).toBe("hidden");
    const main = rule("./layout.css", ".l-sub-main");
    expect(main["overflow-y"]).toBe("auto");
    expect(main["min-height"]).toBe("0");
  });
});
