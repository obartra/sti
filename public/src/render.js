// Pure view layer: every function here takes data and returns an HTML string.
// No DOM access and no shared mutable state, so it can be unit-tested directly
// in Node (see test/render.test.mjs).

import {
  T,
  ORDER,
  STATUS,
  CDC,
  LANGS,
  AUTONYM,
  SHAPES,
  DECO,
  POZ,
} from "./data.js";

// The URL only ever encodes the condition: "/", "/gonorrhea", "/hiv", ...
export function condPath(cond) {
  return cond ? "/" + cond : "/";
}

export function mapsURL(lang) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(T[lang].ui.mapsQuery)
  );
}

export function cta(lang) {
  const ui = T[lang].ui;
  let html = `<a class="cta" href="${mapsURL(lang)}" target="_blank" rel="noopener">
    <span class="freebadge">${ui.freeBadge}</span>
    <span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-5.6-7-11a7 7 0 0114 0c0 5.4-7 11-7 11z" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="10" r="2.4" stroke="#fff" stroke-width="1.7"/></svg></span>
    <span class="body"><span class="t">${ui.ctaTitle}</span><span class="s">${ui.ctaSub}</span></span>
    <svg class="arrow" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h11M10 5l4 4-4 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </a>`;
  if (ui.official) {
    html += `<a class="official" href="${CDC}" target="_blank" rel="noopener">${ui.official.replace(
      /CDC.*$/,
      (m) => "<u>" + m + "</u>",
    )}</a>`;
  }
  return html;
}

export function home(lang) {
  const t = T[lang],
    ui = t.ui;
  const tiles = ORDER.map(
    (k) =>
      `<a class="tile" href="${condPath(k)}" data-nav="${k}"><span class="nm">${t.conditions[k].name}</span><svg class="ar" width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3 9h11M10 5l4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`,
  ).join("");
  return `<h1 class="rise d1">${ui.title}</h1>
    <p class="tagline rise d1">${ui.tagline}</p>
    <section class="rise d2">${cta(lang)}</section>
    <div class="others rise d3"><div class="lbl">${ui.othersLabel}</div><div class="grid">${tiles}</div></div>
    <footer>${ui.footer}</footer>`;
}

export function page(lang, key) {
  const t = T[lang],
    ui = t.ui,
    c = t.conditions[key];
  if (!c) return home(lang);
  const cls = STATUS[key] === "curable" ? "curable" : "treat";
  const blocks = c.qa
    .map(
      ([q, a]) =>
        `<div class="block"><div class="q">${q}</div><div class="a">${a}</div></div>`,
    )
    .join("");
  // On the HIV page, point people living with HIV to the U=U page.
  const extra =
    key === "hiv"
      ? `<a class="pozlink rise d2" href="${condPath("poz")}" data-nav="poz">${POZ[lang].fromHiv}</a>`
      : "";
  return `<a class="back rise d1" href="${condPath("")}" data-nav="home"><svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M15 9H4M8 5L4 9l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>${ui.back}</a>
    <span class="pill ${cls} toppill rise d1">${c.label}</span>
    <h1 class="rise d1">${c.name}</h1>
    <p class="intro rise d2">${c.intro}</p>
    <div class="qa rise d2">${blocks}</div>
    ${extra}
    <section class="rise d3">${cta(lang)}</section>
    <div class="disclaimer rise d3">${ui.disclaimer}</div>
    <footer>${ui.footer}</footer>`;
}

// Care-finder CTA for the U=U page (no "free" badge / CDC link).
export function pozMapsURL(lang) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(POZ[lang].mapsQuery)
  );
}
function pozCTA(lang) {
  const p = POZ[lang];
  return `<a class="cta" href="${pozMapsURL(lang)}" target="_blank" rel="noopener">
    <span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg></span>
    <span class="body"><span class="t">${p.ctaTitle}</span><span class="s">${p.ctaSub}</span></span>
    <svg class="arrow" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h11M10 5l4 4-4 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </a>`;
}

export function pozPage(lang) {
  const p = POZ[lang],
    ui = T[lang].ui;
  const blocks = p.qa
    .map(
      ([q, a]) =>
        `<div class="block"><div class="q">${q}</div><div class="a">${a}</div></div>`,
    )
    .join("");
  return `<a class="back rise d1" href="${condPath("")}" data-nav="home"><svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M15 9H4M8 5L4 9l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>${ui.back}</a>
    <span class="pill poz toppill rise d1">${p.label}</span>
    <h1 class="rise d1">${p.title}</h1>
    <p class="intro rise d2">${p.intro}</p>
    <div class="qa rise d2">${blocks}</div>
    <section class="rise d3">${pozCTA(lang)}</section>
    <div class="disclaimer rise d3">${p.disclaimer}</div>
    <footer>${ui.footer}</footer>`;
}

export function langbarHTML(active) {
  const seg = LANGS.map(
    (l) =>
      `<button data-lang="${l}" lang="${l}" aria-label="${AUTONYM[l]}" aria-pressed="${l === active}" class="${l === active ? "active" : ""}">${l.toUpperCase()}</button>`,
  ).join("");
  return `<div class="seg" role="group" aria-label="Language">${seg}</div>`;
}

// One absolutely-positioned decoration. Anchored to the top/bottom margins and
// bled off the side edges so doodles frame the page without crossing the text.
function dpiece(o) {
  const pos = ["top", "bottom", "left", "right"]
    .map((k) => (o[k] != null ? k + ":" + o[k] + "px;" : ""))
    .join("");
  const rot = o.r ? "transform:rotate(" + o.r + "deg);" : "";
  return `<span class="dp" style="${pos}${rot}">${SHAPES[o.t](o.c, o.w)}</span>`;
}

export function decoHTML(key) {
  const list = DECO[key] || DECO.home;
  return list.map(dpiece).join("");
}
