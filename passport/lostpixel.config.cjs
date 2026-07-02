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

// Skip the "Design System" styleguide (tokens, component galleries, avatar/QR
// demos) and the "PWA/Install screenshots" stories. The first is a reference
// catalogue, not product UI; the second is the SOURCE for the manifest install
// screenshots (scripts/screenshots/generate.mjs pulls from it), not a regression
// target, and capturing it would also demand a phone-size baseline. Both stay
// browsable in Storybook at /design. check-baselines.sh applies the SAME filter so
// the baseline corpus matches what is captured.
stories = stories.filter(
  (entry) =>
    !entry.title.startsWith("Design System") &&
    !entry.title.startsWith("PWA/Install screenshots"),
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

// Chart stories (recharts area/bar in the admin metrics panel) need a wider
// threshold. Their curved and diagonal edges (the monotone area spline, the
// rounded bar corners) anti-alias against a sub-pixel-shifted layout: the
// ResponsiveContainer width settles a hair differently under the sharded visual
// run than under the full-suite baseline capture, so the two contexts differ by
// a STABLE ~110px (0.01%) that the base threshold rejects. The shift is
// imperceptible and two orders of magnitude below a real regression (recolor or
// layout shift = thousands of px), so it is exactly the antialiasing noise the
// absolute threshold exists to absorb; 50 was simply tuned before any chart
// story existed. Scope the wider bound to the chart stories so every other
// story keeps the tight 50-px gate. Disabling recharts' JS-driven animation
// (see MetricsPanel) removes the separate mid-animation race; this covers the
// residual edge antialiasing that remains once the render is settled.
const CHART_THRESHOLD = 300;
const isChartStory = (story) =>
  story.id.startsWith("passport-admin-metricspanel");

// Capture determinism comes from the runner itself: lost-pixel passes
// Playwright's `animations: 'disabled'` to every screenshot, which settles
// finite animations and cancels infinite ones before the shot. (A per-page
// beforeScreenshot hook is not part of lost-pixel's page schema and would be
// silently stripped; only the top-level hook runs. Do not rely on one here.)
const pages = stories.map((story) => ({
  path: `iframe.html?viewMode=story&id=${story.id}`,
  name: story.id,
  threshold: isChartStory(story) ? CHART_THRESHOLD : PAGE_THRESHOLD,
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
  // Shoot stories in parallel for speed (env-tunable via LOST_PIXEL_CONCURRENCY).
  // flakynessRetries re-takes a shot until two reads agree, which heals the rare
  // blank a capture race produces at this moderate concurrency (its re-take comes
  // back painted). The settle window stays generous, and as a backstop the guard
  // in scripts/visual-regression.sh re-shoots any still-differing story in
  // isolation: a capture artifact then matches, a real change still differs.
  // The per-page threshold below absorbs sub-pixel antialiasing.
  shotConcurrency: Number(process.env.LOST_PIXEL_CONCURRENCY) || 2,
  waitBeforeScreenshot: 1200,
  flakynessRetries: 2,
};
