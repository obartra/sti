// Controller: owns the small bit of mutable state, wires the views into the
// DOM, and handles routing + the language toggle. This is the only module that
// touches the DOM / browser APIs.

import { LANGS, T } from "./data.js";
import { home, page, condPath, langbarHTML, decoHTML } from "./render.js";

let LANG = "en";
let CUR = "";
const LSKEY = "sti.lang";

// Language is chosen by the visitor, not encoded in the URL. Order of
// preference: a remembered choice (localStorage) -> the browser's language
// -> English. A ?lang=xx query param (handy for sharing a specific language)
// overrides and is then remembered.
function stored() {
  try {
    const v = localStorage.getItem(LSKEY);
    return LANGS.includes(v) ? v : null;
  } catch (e) {
    return null;
  }
}
function remember(l) {
  try {
    localStorage.setItem(LSKEY, l);
  } catch (e) {
    /* ignore */
  }
}
function detect() {
  try {
    const l = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGS.includes(l) ? l : "en";
  } catch (e) {
    return "en";
  }
}
function queryLang() {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    return LANGS.includes(q) ? q : null;
  } catch (e) {
    return null;
  }
}
function initialLang() {
  return queryLang() || stored() || detect();
}

// ----- routing -----
// The URL encodes only the condition, so a link like sti.care/gonorrhea shows
// in each visitor's own preferred language.
function currentPath() {
  return condPath(CUR);
}
function syncURL(push) {
  try {
    const path = currentPath() + location.search;
    if (location.pathname + location.search === path) return;
    if (push) history.pushState(null, "", path);
    else history.replaceState(null, "", path);
  } catch (e) {
    /* ignore */
  }
}
function parsePath() {
  const parts = (location.pathname || "/").split("/").filter(Boolean);
  return parts.length ? parts[0] : "";
}

// Switching language re-renders in place and remembers the choice; it does not
// touch the URL.
function setLang(l) {
  if (!LANGS.includes(l)) return;
  LANG = l;
  remember(l);
  document.documentElement.lang = l;
  renderLangbar();
  renderApp();
}
function go(cond) {
  CUR = cond === "home" ? "" : cond;
  syncURL(true);
  renderApp();
}
function route() {
  const cond = parsePath();
  CUR = cond && T[LANG].conditions[cond] ? cond : "";
  document.documentElement.lang = LANG;
  renderLangbar();
  renderApp();
}

function renderLangbar() {
  document.getElementById("langbar").innerHTML = langbarHTML(LANG);
}
function renderApp() {
  const key = CUR && T[LANG].conditions[CUR] ? CUR : "home";
  document.getElementById("app").innerHTML =
    key === "home" ? home(LANG) : page(LANG, key);
  document.getElementById("deco").innerHTML = decoHTML(key);
  try {
    window.scrollTo(0, 0);
  } catch (e) {
    /* ignore */
  }
}

document.addEventListener("click", function (e) {
  const l = e.target.closest("[data-lang]");
  if (l) {
    setLang(l.getAttribute("data-lang"));
    return;
  }
  const a = e.target.closest("[data-nav]");
  if (a) {
    // Let the browser open the real URL in a new tab/window on modifier-clicks.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();
    go(a.getAttribute("data-nav"));
  }
});
window.addEventListener("popstate", route);

function init() {
  LANG = initialLang();
  if (queryLang()) remember(LANG); // honor & persist a shared ?lang= link
  route();
  syncURL(false); // tidy the address bar (e.g. an unknown "/foo" -> "/")
}

init();
