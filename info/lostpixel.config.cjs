/**
 * Lost Pixel visual-regression config for info.sti.care (the same mechanism as
 * the passport's; see passport/lostpixel.config.cjs). The corpus is the built
 * static site: one entry per dist/*.html page, each captured full-page at a
 * phone and a desktop width, since the two renders are distinct compositions
 * (site.css vs the 900px desktop layer).
 *
 * Both local runs and CI invoke this inside the pinned lost-pixel Docker image
 * (scripts/visual-regression.sh) so Linux Chromium renders the pixels the same
 * in both places. Do not run lost-pixel directly from npm against committed
 * baselines; rendering diverges across hosts.
 */

const fs = require("node:fs");
const path = require("node:path");

const DIST = path.join(__dirname, "dist");

if (!fs.existsSync(DIST)) {
  throw new Error(
    `${DIST} not found. Run \`npm run build\` before invoking lost-pixel.`,
  );
}

const slugs = fs
  .readdirSync(DIST)
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\.html$/, ""))
  .sort();

// The 320px floor, a phone, and desktop, straddling the 900px breakpoint
// (docs 34/36). Lost Pixel's per-page `breakpoints` shoots a full-page capture
// per width and suffixes the shot name (`{slug}__[w390px].png`).
const WIDTHS = [320, 390, 1440];

// Absolute pixel threshold for sub-pixel antialiasing noise; real regressions
// (recolor, layout shift) are in the thousands of pixels.
const PAGE_THRESHOLD = 50;

// Targeted re-capture support, same shape as the passport config: when set,
// shoot only these page names, i.e. slugs (scripts/visual-regression.sh's
// blank guard; both widths of the slug re-shoot together).
const onlyIds = (process.env.LOST_PIXEL_ONLY_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let pages = slugs.map((slug) => ({
  path: `/${slug}.html`,
  name: slug,
  breakpoints: WIDTHS,
  threshold: PAGE_THRESHOLD,
}));
if (onlyIds.length > 0) {
  const wanted = new Set(onlyIds);
  pages = pages.filter((p) => wanted.has(p.name));
}

const baseUrl =
  process.env.LOST_PIXEL_PAGE_BASE_URL || "http://host.docker.internal:6067";

module.exports = {
  pageShots: {
    pages,
    baseUrl,
  },
  // The only late-arriving resources on these static pages are the web fonts;
  // captures already run with animations disabled by the runner.
  beforeScreenshot: async (page) => {
    await page.evaluate(() => document.fonts.ready);
  },
  imagePathBaseline: process.env.LOST_PIXEL_BASELINE_DIR || "visual-baselines/",
  imagePathCurrent: ".lostpixel/current/",
  imagePathDifference: ".lostpixel/difference/",
  threshold: 0,
  failOnDifference: true,
  // Self-hosted (non-platform) mode: without this the runner skips the
  // diff-aware non-zero exit and the gate degrades to "always passes".
  generateOnly: true,
  shotConcurrency: Number(process.env.LOST_PIXEL_CONCURRENCY) || 2,
  waitBeforeScreenshot: 1200,
  flakynessRetries: 2,
};
