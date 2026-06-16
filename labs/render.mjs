// Render the labs site: turn the published markdown docs into sti.care-styled
// HTML pages and generate the landing page. Pure file-in / file-out; no network.
//
// Usage: node labs/render.mjs --out <dir>
//   Reads labs/labs.config.json (which docs publish, in order) and the markdown
//   from labs/docs/, and writes <dir>/index.html + <dir>/docs/<slug>.html.
//   labs.css and favicon are copied in by build-labs.sh, not here.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const OUT = arg("--out");
if (!OUT) {
  console.error("render.mjs: --out <dir> is required");
  process.exit(1);
}

const config = JSON.parse(readFileSync(join(HERE, "labs.config.json"), "utf8"));

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&#?\w+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

marked.setOptions({ gfm: true, breaks: false });

const FONTS = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />`;

const FOOTER = `<footer>
        <a href="https://sti.care">sti.care</a> · prototypes and design notes ·
        not medical advice
      </footer>`;

function page({ title, description, bodyClass, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#fbf2dd" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />${FONTS}
    <link rel="stylesheet" href="/labs.css" />
  </head>
  <body>
    <div class="wrap${bodyClass ? " " + bodyClass : ""}">
${body}
    </div>
  </body>
</html>
`;
}

// Add stable ids to h2/h3 so deep links work, and collect h2s for a TOC.
function addAnchors(html) {
  const toc = [];
  const used = new Set();
  const out = html.replace(
    /<h([23])>([\s\S]*?)<\/h\1>/g,
    (_m, level, inner) => {
      let id = slugify(inner) || "section";
      let n = 2;
      const base = id;
      while (used.has(id)) id = `${base}-${n++}`;
      used.add(id);
      if (level === "2") {
        toc.push({ id, text: inner.replace(/<[^>]+>/g, "").trim() });
      }
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );
  return { html: out, toc };
}

function tocBlock(toc) {
  if (toc.length < 3) return "";
  // t.text is already HTML-escaped (it comes from marked's rendered heading with
  // tags stripped), so emit it as-is rather than escaping a second time.
  const items = toc
    .map((t) => `<li><a href="#${t.id}">${t.text}</a></li>`)
    .join("\n          ");
  return `      <nav class="toc">
        <div class="toc-h">On this page</div>
        <ul>
          ${items}
        </ul>
      </nav>
`;
}

function crossnav(currentSlug) {
  const links = [
    `<a href="${esc(config.prototype.path)}">${esc(config.prototype.label)} prototype</a>`,
  ];
  for (const d of config.docs) {
    if (d.slug === currentSlug) continue;
    links.push(`<a href="/docs/${esc(d.slug)}">${esc(d.title)}</a>`);
  }
  return `      <nav class="crossnav">
        ${links.join("\n        ")}
      </nav>
`;
}

// A feedback call-to-action for docs flagged with `feedback: true`. Renders a
// live button when feedbackUrl is set, otherwise a neutral "coming soon" note so
// a deploy never ships a dead link.
function feedbackBlock() {
  const url = (config.feedbackUrl || "").trim();
  const label = esc(config.feedbackLabel || "Share feedback");
  if (!url) {
    return `      <div class="feedbackcta">
        <p class="feedback-note">A feedback form is on the way. Check back soon.</p>
      </div>
`;
  }
  return `      <div class="feedbackcta">
        <p>Have a perspective on any of these? I'd genuinely value your read.</p>
        <a class="feedbackbtn" href="${esc(url)}">${label} →</a>
      </div>
`;
}

// ---- doc pages ----
mkdirSync(join(OUT, "docs"), { recursive: true });
for (const d of config.docs) {
  const md = readFileSync(join(HERE, "docs", d.file), "utf8");
  const h1 = md.match(/^#\s+(.+)$/m);
  const pageTitle = `${d.title} — ${config.title}`;
  const rendered = addAnchors(marked.parse(md));
  const body = `      <a class="back" href="/">← ${esc(config.title)}</a>
${tocBlock(rendered.toc)}      <article class="prose">
${rendered.html}
      </article>
${d.feedback ? feedbackBlock() : ""}${crossnav(d.slug)}      ${FOOTER}`;
  writeFileSync(
    join(OUT, "docs", `${d.slug}.html`),
    page({
      title: pageTitle,
      description: d.blurb || (h1 ? h1[1] : d.title),
      bodyClass: "doc",
      body,
    }),
  );
  console.error(`  docs/${d.slug}.html  (from ${d.file})`);
}

// ---- landing page ----
const p = config.prototype;
const tiles = config.docs
  .map(
    (d, i) => `        <a class="doctile" href="/docs/${esc(d.slug)}">
          <span class="dt-n">${i + 1}</span>
          <span>
            <span class="dt-title">${esc(d.title)}</span>
            <span class="dt-blurb">${esc(d.blurb)}</span>
          </span>
          <span class="dt-ar">→</span>
        </a>`,
  )
  .join("\n");

const landingBody = `      <h1>${esc(config.title)}</h1>
      <p class="tagline">${esc(config.tagline)}</p>
      <p class="lead">${esc(config.intro)}</p>

      <section>
        <div class="seclabel">Prototype</div>
        <a class="feature" href="${esc(p.path)}">
          <span class="badge">Live prototype</span>
          <span class="ftitle">${esc(p.label)}</span>
          <p class="fblurb">${esc(p.blurb)}</p>
          <span class="fcta">${esc(p.cta)} →</span>
        </a>
      </section>

      <section>
        <div class="seclabel">${esc(config.docsHeading)}</div>
        <p class="lead" style="margin-bottom: 18px">${esc(config.docsIntro)}</p>
        <div class="doclist">
${tiles}
        </div>
      </section>

      ${FOOTER}`;

writeFileSync(
  join(OUT, "index.html"),
  page({
    title: config.title,
    description: config.intro,
    bodyClass: "",
    body: landingBody,
  }),
);
console.error("  index.html  (landing)");
