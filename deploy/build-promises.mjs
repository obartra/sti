// Build the public promises report: a themed, source-free page that shows the
// product's trust promises (the Gherkin scenarios) and how each is asserted,
// for anyone who wants to drill in. Output: public/promises/index.html, served
// at sti.care/promises. Pure file-in / file-out, stdlib only.
//
// Usage: node deploy/build-promises.mjs

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FEATURE_DIR = join(ROOT, "passport", "src", "core");
const OUT_DIR = join(ROOT, "public", "promises");

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function version() {
  try {
    return execSync("git describe --tags --always --dirty", {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    // Netlify's shallow checkout can lack git history; fall back to the commit
    // ref it provides in the environment.
    const ref = process.env.COMMIT_REF;
    return ref ? ref.slice(0, 7) : "dev";
  }
}

function today() {
  const d = new Date();
  return `${String(d.getDate())} ${MONTHS[d.getMonth()]} ${String(d.getFullYear())}`;
}

// Minimal Gherkin parse: Feature (+ its prose), Background givens, Scenarios
// (name + steps). Enough for the feature files this repo writes.
function parseFeature(text) {
  const lines = text.split("\n");
  const feature = { name: "", prose: [], scenarios: [] };
  let current = null;
  let inProse = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const feat = /^Feature:\s*(.*)$/.exec(line);
    const scen = /^Scenario:\s*(.*)$/.exec(line);
    const step = /^(Given|When|Then|And|But)\s+(.*)$/.exec(line);
    if (feat) {
      feature.name = feat[1];
      inProse = true;
    } else if (/^Background:/.test(line)) {
      inProse = false;
      current = null;
    } else if (scen) {
      inProse = false;
      current = { name: scen[1], steps: [] };
      feature.scenarios.push(current);
    } else if (step && current) {
      current.steps.push({ keyword: step[1], text: step[2] });
    } else if (step && !current) {
      // Background steps: shared setup, not shown per scenario.
    } else if (inProse) {
      feature.prose.push(line);
    }
  }
  return feature;
}

// Classify the asserted outcome so each promise carries a small on-brand tag.
function outcome(scenario) {
  const then = scenario.steps.find((s) => s.keyword === "Then");
  const t = then ? then.text.toLowerCase() : "";
  if (t.includes("blue")) return { kind: "blue", label: "Blue" };
  if (t.includes("gray")) return { kind: "gray", label: "Gray" };
  if (t.includes("reads")) return { kind: "headline", label: "Headline" };
  return { kind: "neutral", label: "Holds" };
}

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function stepRow(step) {
  const assert = step.keyword === "Then";
  const cls = assert ? "step step--then" : "step";
  return `<li class="${cls}"><span class="kw">${esc(step.keyword)}</span> ${esc(step.text)}</li>`;
}

function promiseCard(scenario) {
  const o = outcome(scenario);
  const steps = scenario.steps.map(stepRow).join("");
  return `<article class="promise">
      <div class="promise__head">
        <h3>${esc(scenario.name)}</h3>
        <span class="tag tag--${o.kind}">${o.label}</span>
      </div>
      <ul class="steps">${steps}</ul>
    </article>`;
}

function featureSection(feature) {
  const prose = feature.prose.length
    ? `<p class="feature__prose">${esc(feature.prose.join(" "))}</p>`
    : "";
  const cards = feature.scenarios.map(promiseCard).join("\n    ");
  return `<section class="feature">
    <h2>${esc(feature.name)}</h2>
    ${prose}
    <div class="promises">
    ${cards}
    </div>
  </section>`;
}

function render(features, ver, date) {
  const sections = features.map(featureSection).join("\n  ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Our promises · sti.care</title>
<meta name="description" content="The trust promises sti.care makes, and how each one is asserted." />
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
    --gray-soft: #ececed;
    --gray-ink: #6b6b7b;
    --border: #e7e4dc;
    --radius: 16px;
    --mono: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-family: "Hanken Grotesk", system-ui, -apple-system, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--surface-app);
    color: var(--ink-700);
    line-height: 1.55;
  }
  main { max-width: 760px; margin: 0 auto; padding: 56px 22px 80px; }
  .brand {
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--ink-900);
    font-size: 17px;
  }
  .brand span { color: var(--accent); }
  .eyebrow {
    margin-top: 36px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-ink);
  }
  h1 {
    font-size: clamp(30px, 5vw, 42px);
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--ink-900);
    margin: 10px 0 0;
  }
  .lead { font-size: 17px; margin: 16px 0 0; max-width: 60ch; }
  .stamp {
    margin-top: 18px;
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink-500);
  }
  .stamp b { color: var(--ink-700); font-weight: 600; }
  .feature { margin-top: 48px; }
  .feature h2 {
    font-size: 21px;
    letter-spacing: -0.01em;
    color: var(--ink-900);
    margin: 0;
  }
  .feature__prose { color: var(--ink-500); font-size: 14.5px; margin: 8px 0 0; }
  .promises {
    margin-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .promise {
    background: var(--surface-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
  }
  .promise__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .promise__head h3 {
    margin: 0;
    font-size: 16px;
    color: var(--ink-900);
    letter-spacing: -0.01em;
  }
  .tag {
    flex: none;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .tag--blue { background: var(--accent-soft); color: var(--accent-ink); }
  .tag--gray { background: var(--gray-soft); color: var(--gray-ink); }
  .tag--headline,
  .tag--neutral { background: var(--surface-tint); color: var(--accent-ink); }
  .steps { list-style: none; margin: 14px 0 0; padding: 0; }
  .step {
    font-size: 14px;
    color: var(--ink-500);
    padding: 3px 0 3px 14px;
    border-left: 2px solid var(--border);
  }
  .step--then {
    color: var(--ink-900);
    font-weight: 600;
    border-left-color: var(--accent);
  }
  .kw {
    font-family: var(--mono);
    font-size: 11.5px;
    font-weight: 700;
    color: var(--accent-ink);
    margin-right: 4px;
  }
  .note {
    margin-top: 48px;
    padding: 18px 20px;
    background: var(--surface-tint);
    border-radius: var(--radius);
    font-size: 13.5px;
    color: var(--ink-700);
  }
  footer {
    margin-top: 40px;
    border-top: 1px solid var(--border);
    padding-top: 20px;
    font-size: 12.5px;
    color: var(--ink-300);
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  footer .stamp { margin: 0; }
</style>
</head>
<body>
<main>
  <div class="brand">sti<span>.care</span></div>
  <div class="eyebrow">Trust, in the open</div>
  <h1>Our promises</h1>
  <p class="lead">
    sti.care makes a small set of hard promises about what a status can and
    cannot reveal. Each one below is an executable specification: it runs as a
    test on every change, and the trust-critical rules are also proven
    exhaustively by property-based tests.
  </p>
  <div class="stamp">Published <b>${esc(date)}</b> &middot; <b>${esc(ver)}</b></div>

  ${sections}

  <div class="note">
    These are the plain-language scenarios from the codebase, rendered as-is.
    The <b>Then</b> line is the assertion. A green build is required to publish,
    so every promise here is currently passing.
  </div>

  <footer>
    <span>sti.care</span>
    <span class="stamp">Published ${esc(date)} &middot; ${esc(ver)}</span>
  </footer>
</main>
</body>
</html>
`;
}

function main() {
  const files = readdirSync(FEATURE_DIR).filter((f) => f.endsWith(".feature"));
  const features = files
    .sort()
    .map((f) => parseFeature(readFileSync(join(FEATURE_DIR, f), "utf8")))
    .filter((f) => f.scenarios.length > 0);
  const html = render(features, version(), today());
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "index.html"), html);
  const n = features.reduce((a, f) => a + f.scenarios.length, 0);
  console.log(
    `promises: wrote ${OUT_DIR}/index.html (${String(features.length)} features, ${String(n)} promises)`,
  );
}

main();
