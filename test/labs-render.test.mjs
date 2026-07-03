import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LABS = join(ROOT, "labs");
const config = JSON.parse(readFileSync(join(LABS, "labs.config.json"), "utf8"));

// Render once into a temp dir; every test reads from this output.
const OUT = mkdtempSync(join(tmpdir(), "labs-render-"));
execFileSync("node", [join(LABS, "render.mjs"), "--out", OUT], {
  stdio: ["ignore", "ignore", "inherit"],
});

const read = (rel) => readFileSync(join(OUT, rel), "utf8");

test("emits the landing and exactly the published docs", () => {
  assert.ok(existsSync(join(OUT, "index.html")), "no index.html");
  const emitted = readdirSync(join(OUT, "docs")).sort();
  const expected = config.docs.map((d) => `${d.slug}.html`).sort();
  assert.deepEqual(emitted, expected);
});

test("landing has one tile per published doc and links the prototype", () => {
  const html = read("index.html");
  const tiles = html.match(/class="doctile"/g) || [];
  assert.equal(tiles.length, config.docs.length);
  assert.match(html, new RegExp(`href="${config.prototype.path}"`));
  for (const d of config.docs) {
    // Links are extensionless (clean URLs); GitHub Pages serves the .html file.
    assert.match(html, new RegExp(`href="/docs/${d.slug}"`));
  }
  assert.doesNotMatch(html, /href="\/docs\/[^"]+\.html"/);
});

test("no unpublished source doc leaks into the output", () => {
  const publishedFiles = new Set(config.docs.map((d) => d.file));
  const sources = readdirSync(join(LABS, "docs")).filter((f) =>
    f.endsWith(".md"),
  );
  const unpublished = sources.filter((f) => !publishedFiles.has(f));
  assert.ok(unpublished.length > 0, "expected some unpublished docs to exist");
  // The unpublished filenames must never appear as emitted pages.
  const emitted = readdirSync(join(OUT, "docs"));
  for (const f of unpublished) {
    const slug = f.replace(/\.md$/, "");
    assert.ok(
      !emitted.includes(`${slug}.html`),
      `unpublished ${f} was emitted`,
    );
  }
});

test("privacy guard: no real names appear in any emitted page", () => {
  const files = [
    "index.html",
    ...config.docs.map((d) => `docs/${d.slug}.html`),
  ];
  for (const f of files) {
    const html = read(f);
    assert.doesNotMatch(html, /donja|brandon/i, `name found in ${f}`);
  }
});

test("heading ids are clean and the TOC is not double-escaped", () => {
  for (const d of config.docs) {
    const html = read(`docs/${d.slug}.html`);
    // ids never carry leftover HTML entities (e.g. &#39; from an apostrophe).
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids) {
      assert.doesNotMatch(id, /&|#\d/, `bad id "${id}" in ${d.slug}`);
    }
    // TOC links must not be escaped twice (&amp;#39; instead of ').
    assert.doesNotMatch(html, /&amp;#/, `double-escaped entity in ${d.slug}`);
  }
});

test("decisions doc gets status pills + a single legend; other docs don't", () => {
  const decisions = read("docs/decisions.html");
  // One legend, placed after the intro rule (before the first section heading).
  assert.equal(
    (decisions.match(/class="legend"/g) || []).length,
    1,
    "expected exactly one status legend",
  );
  assert.ok(
    decisions.indexOf('class="legend"') < decisions.indexOf("<h2"),
    "legend should sit above the first section",
  );
  // The status lead-ins became pills, so the raw "LOCKED — " text is gone.
  assert.match(decisions, /class="pill pill-locked"/);
  assert.doesNotMatch(decisions, /<strong>\s*LOCKED\s*—/);
  // A doc that doesn't use the vocabulary gets neither pills nor a legend.
  const philosophy = read("docs/philosophy.html");
  assert.doesNotMatch(philosophy, /class="legend"/);
  assert.doesNotMatch(philosophy, /class="pill/);
});

test("emits an honest 404 page, distinct from the landing", () => {
  const notFound = read("404.html");
  assert.match(notFound, /404/);
  assert.match(notFound, /not found/i);
  // It must be a real not-found page, not an SPA-style copy of the landing.
  assert.notEqual(notFound, read("index.html"));
});

test("feedback page renders the in-house response form", () => {
  const fb = config.docs.find((d) => d.feedback);
  assert.ok(fb, "expected a doc flagged feedback:true");
  const html = read(`docs/${fb.slug}.html`);
  // The form posts straight to the blind feedback intake (doc 35): a topic
  // picker, a length-capped note, and a send; no third-party form service.
  assert.match(html, /id="ansform"/);
  assert.match(html, /id="ans-topic"/);
  assert.match(html, /maxlength="2000"/);
  assert.match(html, new RegExp(config.feedbackApi.replace(/[/.]/g, "\\$&")));
  assert.doesNotMatch(html, /forms\.gle/);
});
