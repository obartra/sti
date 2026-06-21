// Build the product-behavior validation report: a themed page that shows every
// behavior we intend the product to have, grouped by category and tagged, with a
// status (validated / characterized / planned). Sibling to build-promises.mjs,
// but about "does it behave as we intend" rather than the public trust promises.
// This is an INTERNAL artifact, a doc to talk about: it is written to reports/
// (gitignored, outside the dist/ publish dir), so it is never served publicly.
// Source of truth: passport/src/loadlab/behaviors.json (the same catalog the load
// lab tags its tests against). Output: reports/behaviors/index.html. Stdlib only.
//
// Usage: node deploy/build-behaviors.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { version, today, esc } from "./report-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = join(ROOT, "passport", "src", "loadlab", "behaviors.json");
const OUT_DIR = join(ROOT, "reports", "behaviors");

const STATUS_LABEL = {
  validated: "Validated",
  characterized: "Characterized",
  planned: "Planned",
};

// Group behaviors by category, preserving first-seen order (the catalog is
// authored in display order).
function groupByCategory(behaviors) {
  const groups = new Map();
  for (const b of behaviors) {
    if (!groups.has(b.category)) groups.set(b.category, []);
    groups.get(b.category).push(b);
  }
  return groups;
}

// A readable name for the suite/module that pins a behavior (from its pin path).
function pinLabel(pin) {
  if (pin.endsWith("loadlab.integration.test.ts")) return "load lab";
  if (pin.endsWith("resolution.pw.spec.ts")) return "Playwright";
  if (pin.endsWith("stress.ts")) return "stress CLI";
  if (pin.endsWith("_test.go")) return "Go server";
  if (pin.includes("/crypto/")) return "crypto unit";
  if (pin.includes("/store/") && pin.includes(".integration."))
    return "store integration";
  if (pin.includes("/store/")) return "store unit";
  return pin;
}

function behaviorCard(b) {
  return `<article class="b">
      <div class="b__head">
        <h3>${esc(b.title)}</h3>
        <span class="status status--${esc(b.status)}">${esc(STATUS_LABEL[b.status] ?? b.status)}</span>
      </div>
      <p class="b__intent">${esc(b.intent)}</p>
      <p class="b__check"><span class="kw">check</span> ${esc(b.check)}</p>
      <div class="b__foot">
        <span class="meta">${esc(b.id)} &middot; ${esc(b.layer)} &middot; pinned: ${esc(pinLabel(b.pin))} &middot; doc ${esc(b.docRef)}</span>
      </div>
    </article>`;
}

function categorySection(name, behaviors) {
  const cards = behaviors.map(behaviorCard).join("\n    ");
  return `<section class="cat">
    <h2>${esc(name)}</h2>
    <div class="bs">
    ${cards}
    </div>
  </section>`;
}

function counts(behaviors) {
  const by = { validated: 0, characterized: 0, planned: 0 };
  for (const b of behaviors) if (b.status in by) by[b.status]++;
  return by;
}

function render(behaviors, ver, date) {
  const groups = groupByCategory(behaviors);
  const sections = [...groups.entries()]
    .map(([name, bs]) => categorySection(name, bs))
    .join("\n  ");
  const c = counts(behaviors);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Does it behave? · sti.care</title>
<meta name="description" content="The behaviors sti.care intends the product to have, grouped and tagged, and how each is validated." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root {
    --surface-app: #fbf9f4;
    --surface-card: #ffffff;
    --surface-tint: #f1f6f7;
    --ink-900: #1b1b2f;
    --ink-700: #3a3a4d;
    --ink-500: #6b6b7b;
    --ink-300: #a6a6b3;
    --accent: #2f9bb3;
    --accent-soft: #e7f3f6;
    --accent-ink: #1f6f82;
    --ok-soft: #e3f3e9;
    --ok-ink: #1f7a4d;
    --warn-soft: #fbeed6;
    --warn-ink: #8a5a12;
    --gray-soft: #ececed;
    --gray-ink: #6b6b7b;
    --border: #e7e4dc;
    --radius: 16px;
    --mono: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-family: "Hanken Grotesk", system-ui, -apple-system, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--surface-app); color: var(--ink-700); line-height: 1.55; }
  main { max-width: 820px; margin: 0 auto; padding: 56px 22px 80px; }
  .brand { font-weight: 800; letter-spacing: -0.01em; color: var(--ink-900); font-size: 17px; }
  .brand span { color: var(--accent); }
  .eyebrow { margin-top: 36px; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent-ink); }
  h1 { font-size: clamp(30px, 5vw, 42px); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink-900); margin: 10px 0 0; }
  .lead { font-size: 17px; margin: 16px 0 0; max-width: 62ch; }
  .stamp { margin-top: 18px; font-family: var(--mono); font-size: 12.5px; color: var(--ink-500); }
  .stamp b { color: var(--ink-700); font-weight: 600; }
  .summary { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font-size: 12.5px; font-weight: 700; padding: 5px 12px; border-radius: 999px; }
  .chip--validated { background: var(--ok-soft); color: var(--ok-ink); }
  .chip--characterized { background: var(--warn-soft); color: var(--warn-ink); }
  .chip--planned { background: var(--gray-soft); color: var(--gray-ink); }
  .cat { margin-top: 44px; }
  .cat h2 { font-size: 21px; letter-spacing: -0.01em; color: var(--ink-900); margin: 0; }
  .bs { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }
  .b { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
  .b__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .b__head h3 { margin: 0; font-size: 16px; color: var(--ink-900); letter-spacing: -0.01em; }
  .status { flex: none; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; padding: 3px 10px; border-radius: 999px; }
  .status--validated { background: var(--ok-soft); color: var(--ok-ink); }
  .status--characterized { background: var(--warn-soft); color: var(--warn-ink); }
  .status--planned { background: var(--gray-soft); color: var(--gray-ink); }
  .b__intent { margin: 12px 0 0; font-size: 14.5px; color: var(--ink-700); }
  .b__check { margin: 8px 0 0; font-size: 13.5px; color: var(--ink-500); padding-left: 14px; border-left: 2px solid var(--accent); }
  .kw { font-family: var(--mono); font-size: 11.5px; font-weight: 700; color: var(--accent-ink); margin-right: 4px; }
  .b__foot { margin-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .meta { font-family: var(--mono); font-size: 11.5px; color: var(--ink-300); }
  .note { margin-top: 44px; padding: 18px 20px; background: var(--surface-tint); border-radius: var(--radius); font-size: 13.5px; color: var(--ink-700); }
  footer { margin-top: 40px; border-top: 1px solid var(--border); padding-top: 20px; font-size: 12.5px; color: var(--ink-300); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
  footer .stamp { margin: 0; }
</style>
</head>
<body>
<main>
  <div class="brand">sti<span>.care</span></div>
  <div class="eyebrow">Does it behave?</div>
  <h1>Product behavior map</h1>
  <p class="lead">
    The full map of behaviors we intend the product to have, grouped by category
    (most trust-critical first). Each names where it is <b>pinned</b>, the suite
    that validates it. <b>validated</b> means a passing test pins it;
    <b>characterized</b> means we measure and report it but do not yet gate on it;
    <b>planned</b> means intended and not yet built.
  </p>
  <div class="stamp">Generated <b>${esc(date)}</b> &middot; <b>${esc(ver)}</b></div>
  <div class="summary">
    <span class="chip chip--validated">${c.validated} validated</span>
    <span class="chip chip--characterized">${c.characterized} characterized</span>
    <span class="chip chip--planned">${c.planned} planned</span>
  </div>

  ${sections}

  <div class="note">
    Kept honest by meta-tests: a behavior pinned in the load lab or Playwright
    must be covered by a tagged test there, and every behavior's pin file must
    exist, so the map can never claim coverage it lacks or name a vanished suite.
    A green build means every "validated" badge above is currently true.
  </div>

  <footer>
    <span>sti.care</span>
    <span class="stamp">Generated ${esc(date)} &middot; ${esc(ver)}</span>
  </footer>
</main>
</body>
</html>
`;
}

function main() {
  const behaviors = JSON.parse(readFileSync(CATALOG, "utf8"));
  const html = render(behaviors, version(), today());
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "index.html"), html);
  const c = counts(behaviors);
  console.log(
    `behaviors: wrote ${OUT_DIR}/index.html (${String(behaviors.length)} behaviors: ${String(c.validated)} validated, ${String(c.characterized)} characterized, ${String(c.planned)} planned)`,
  );
}

main();
