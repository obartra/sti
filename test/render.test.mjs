import { test } from "node:test";
import assert from "node:assert/strict";

import { LANGS, ORDER, STATUS, T, SHAPES, DECO } from "../public/src/data.js";
import {
  condPath,
  mapsURL,
  home,
  page,
  langbarHTML,
  decoHTML,
} from "../public/src/render.js";

test("every language defines every condition", () => {
  for (const lang of LANGS) {
    for (const key of ORDER) {
      const c = T[lang].conditions[key];
      assert.ok(c, `${lang}/${key} missing`);
      assert.ok(c.name && c.label && c.intro, `${lang}/${key} incomplete`);
      assert.ok(Array.isArray(c.qa) && c.qa.length > 0, `${lang}/${key} no qa`);
    }
  }
});

test("condPath builds clean, language-free paths", () => {
  assert.equal(condPath(""), "/");
  assert.equal(condPath("gonorrhea"), "/gonorrhea");
});

test("mapsURL is a valid encoded maps link per language", () => {
  for (const lang of LANGS) {
    const url = mapsURL(lang);
    assert.match(
      url,
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
    );
    assert.ok(!/\s/.test(url), `${lang} maps query not encoded`);
  }
});

test("home page lists every condition and the title", () => {
  for (const lang of LANGS) {
    const html = home(lang);
    assert.ok(html.includes(T[lang].ui.title), `${lang} title missing`);
    for (const key of ORDER) {
      assert.ok(
        html.includes(T[lang].conditions[key].name),
        `${lang} home missing ${key}`,
      );
    }
  }
});

test("condition page shows name, label, status pill and a back link", () => {
  for (const key of ORDER) {
    const html = page("en", key);
    const c = T.en.conditions[key];
    assert.ok(html.includes(c.name));
    assert.ok(html.includes(c.label));
    assert.ok(
      html.includes(`pill ${STATUS[key] === "curable" ? "curable" : "treat"}`),
    );
    assert.ok(html.includes('data-nav="home"'));
  }
});

test("unknown condition falls back to home", () => {
  assert.equal(page("en", "not-a-real-condition"), home("en"));
});

test("langbar marks exactly one active language", () => {
  const html = langbarHTML("es");
  assert.equal((html.match(/<button/g) || []).length, LANGS.length);
  assert.ok(html.includes('aria-pressed="true"'));
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
});

test("every decoration references a defined shape", () => {
  for (const key of Object.keys(DECO)) {
    assert.ok(decoHTML(key).length > 0, `${key} has no deco`);
    for (const piece of DECO[key]) {
      assert.ok(SHAPES[piece.t], `${key} uses unknown shape ${piece.t}`);
    }
  }
});
