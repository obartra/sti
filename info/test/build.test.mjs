import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Guards the info site's clean-URL contract against a content-loader regression.
// When info's node_modules drifted from the committed lockfile (a stale astro 4
// against a pinned astro 7), collection entry ids picked up the ".md" file
// extension: `conditions.find((x) => x.id === "hiv")` stopped matching and every
// page built at /hiv.md instead of /hiv. astro check flags the type mismatch, but
// only if a comparison happens to reference an id; this test asserts the built
// output directly, so any future loader change that reshapes ids fails loudly.
//
// Runs under `make check-info` (`npm run test:build`), the one gate step with
// info's node_modules installed, since it builds the site to assert on the output.

const INFO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(INFO, "src", "content");
const PAGES = join(INFO, "src", "pages");

const slugsIn = (dir) =>
  readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));

const conditionSlugs = slugsIn("conditions");
const guideSlugs = slugsIn("guides");
const contentSlugs = [...conditionSlugs, ...guideSlugs];

// Reserved pages are the standalone routes (everything under pages/ except the
// [slug] route that fans out over the collections).
const reservedSlugs = readdirSync(PAGES)
  .filter((f) => f.endsWith(".astro") && !f.startsWith("["))
  .map((f) => f.replace(/\.astro$/, ""));

// Build once into a temp dir; every test reads from this output. A failed build
// throws here and fails the whole suite, which is what we want.
const OUT = mkdtempSync(join(tmpdir(), "info-build-"));
execFileSync(
  join(INFO, "node_modules", ".bin", "astro"),
  ["build", "--outDir", OUT],
  {
    cwd: INFO,
    stdio: ["ignore", "ignore", "inherit"],
  },
);

const read = (rel) => readFileSync(join(OUT, rel), "utf8");
const htmlFiles = () => readdirSync(OUT).filter((f) => f.endsWith(".html"));

test("finds content to build (guards against empty globs)", () => {
  assert.ok(conditionSlugs.length > 0, "no condition markdown found");
  assert.ok(guideSlugs.length > 0, "no guide markdown found");
});

test("every condition and guide builds to a clean, extensionless URL", () => {
  for (const slug of contentSlugs) {
    assert.ok(
      existsSync(join(OUT, `${slug}.html`)),
      `missing clean page for ${slug} (expected ${slug}.html)`,
    );
  }
});

test("emitted pages are exactly the content + reserved slugs, no .md leak", () => {
  const emitted = htmlFiles().sort();
  const expected = [...contentSlugs, ...reservedSlugs]
    .map((s) => `${s}.html`)
    .sort();
  assert.deepEqual(emitted, expected);
  // The regression signature: an id that kept its extension builds "hiv.md.html".
  for (const f of emitted) {
    assert.doesNotMatch(f, /\.md\.html$/, `extension leaked into ${f}`);
  }
});

test("internal links to library pages use clean, extensionless URLs", () => {
  for (const f of htmlFiles()) {
    assert.doesNotMatch(
      read(f),
      /href="\/[^"]*\.md"/,
      `a .md link leaked into ${f}`,
    );
  }
  // Positive check: the styleguide's condition table links by id, so a clean id
  // yields /hiv rather than /hiv.md.
  assert.match(read("styleguide.html"), /href="\/hiv"/);
});

test("the styleguide resolves the hiv condition entry by id", () => {
  // styleguide.astro does `conditions.find((x) => x.id === "hiv")` and renders the
  // facts strip only when that lookup succeeds. Anchor to hiv's own frontmatter
  // so the assertion tracks the data, not a hard-coded copy string.
  const frontmatter = readFileSync(
    join(CONTENT, "conditions", "hiv.md"),
    "utf8",
  );
  const testLine = frontmatter.match(/^test:\s*(.+)$/m);
  assert.ok(testLine, "hiv.md has no `test:` frontmatter");
  assert.ok(
    read("styleguide.html").includes(testLine[1].trim()),
    "styleguide did not render the hiv facts strip (id lookup failed)",
  );
});
