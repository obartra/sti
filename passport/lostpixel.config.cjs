/**
 * Lost Pixel visual-regression config (copied from centaur's mechanism).
 *
 * Reads `storybook-static/index.json` and emits one `pageShots` entry per
 * story. We have a single theme, so the baseline name is just the story id.
 *
 * Both local runs and CI invoke this inside the pinned lost-pixel Docker image
 * (see scripts/visual-regression.sh) so Linux Chromium renders the pixels the
 * same in both places. Do not run lost-pixel directly from npm against
 * committed baselines; rendering diverges across hosts.
 */

const fs = require("node:fs");
const path = require("node:path");

const INDEX_PATH = path.join(__dirname, "storybook-static", "index.json");

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(
    `${INDEX_PATH} not found. Run \`npm run build-storybook\` before invoking lost-pixel.`,
  );
}

const indexJson = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
let stories = Object.values(indexJson.entries).filter(
  (entry) => entry.type === "story",
);

// Targeted re-capture: when set, shoot only these story ids. A heavy story very
// occasionally blanks under full-suite capture (resource race), and re-running
// the whole suite just relocates the blank. The update guard in
// scripts/visual-regression.sh re-runs only the blank ids in isolation, where
// the per-story blank probability is low, so it converges. Same Docker render
// path, so the re-shot pixels stay byte-identical to a full run.
const onlyIds = (process.env.LOST_PIXEL_ONLY_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (onlyIds.length > 0) {
  const wanted = new Set(onlyIds);
  stories = stories.filter((story) => wanted.has(story.id));
}

// Absolute pixel threshold for sub-pixel antialiasing noise (per lost-pixel
// docs an absolute count beats a percentage, which scales with image area).
// Real regressions (recolor, layout shift) are in the thousands of pixels.
const PAGE_THRESHOLD = 50;

// prefers-reduced-motion collapses animations/transitions to ~0ms (visual-reset.css),
// so animated components capture deterministically across runs.
const emulateReducedMotion = async (page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
};

const pages = stories.map((story) => ({
  path: `iframe.html?viewMode=story&id=${story.id}`,
  name: story.id,
  threshold: PAGE_THRESHOLD,
  beforeScreenshot: emulateReducedMotion,
}));

// scripts/visual-regression.sh sets this: Linux uses --network host so
// localhost reaches the static server; macOS uses host.docker.internal.
const baseUrl =
  process.env.LOST_PIXEL_PAGE_BASE_URL || "http://host.docker.internal:6066";

module.exports = {
  pageShots: {
    pages,
    baseUrl,
    // StoryMounted sets this after React's first commit AND after in-tree <img>
    // elements decode, so the capture is never the iframe shell or a half-painted tree.
    waitForSelector: "body[data-story-mounted]",
  },
  // Committed baselines live alongside source so PR review surfaces image diffs
  // as binary file changes; current/diff stay gitignored. The baseline dir is
  // overridable so the update guard can re-shoot a single blank story into a
  // throwaway dir (lost-pixel prunes baselines not in its page set, so a
  // filtered re-run must NOT point at the real baseline dir).
  imagePathBaseline: process.env.LOST_PIXEL_BASELINE_DIR || "visual-baselines/",
  imagePathCurrent: ".lostpixel/current/",
  imagePathDifference: ".lostpixel/difference/",
  threshold: 0,
  failOnDifference: true,
  // Self-hosted (non-platform) mode: without this the runner skips the
  // diff-aware non-zero exit and the gate degrades to "always passes".
  generateOnly: true,
  // Determinism without the cost of full serialization. The mount-paint signal
  // (waitForSelector body[data-story-mounted], set after a double rAF) is what
  // actually guarantees a fully painted capture, so we can shoot a few stories
  // in parallel; the rare blank that a resource race still produces is caught
  // and re-shot in isolation by the guard in scripts/visual-regression.sh. No
  // flakyness retries: every shot is deterministic, so re-shooting to compare
  // just doubled the work. A generous settle window stays as belt-and-braces.
  shotConcurrency: Number(process.env.LOST_PIXEL_CONCURRENCY) || 3,
  waitBeforeScreenshot: 1200,
  flakynessRetries: 0,
};
