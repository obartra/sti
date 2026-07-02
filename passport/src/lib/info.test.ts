import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { infoUrl } from "./info.ts";
import { LEARN_MAP } from "../ui/core/Report.parts.tsx";

describe("infoUrl", () => {
  it("resolves the library index and normalizes paths", () => {
    expect(infoUrl()).toBe("https://info.sti.care/");
    expect(infoUrl("/testing")).toBe("https://info.sti.care/testing");
    expect(infoUrl("gonorrhea")).toBe("https://info.sti.care/gonorrhea");
  });
});

// Every deep link the app renders must land on a page the info site actually
// builds (doc 34: a repointed link can never dangle silently). The info site's
// routes are its content collections' filenames, so read them directly.
describe("app links into the info site", () => {
  it("point at real info pages", () => {
    const content = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../info/src/content",
    );
    const pages = new Set(
      ["conditions", "guides"].flatMap((dir) =>
        readdirSync(join(content, dir)).map((f) => f.replace(/\.md$/, "")),
      ),
    );

    // The slugs the app deep-links: the Care hub and /exposed testing guide,
    // the report share step's partner guide, and the report flow's condition
    // explainers (LEARN_MAP).
    const linked = ["testing", "tell-a-partner", ...Object.values(LEARN_MAP)];
    for (const slug of linked) {
      expect(pages, `info page missing for /${slug}`).toContain(slug);
    }
  });
});
