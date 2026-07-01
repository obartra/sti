// @ts-check
import { defineConfig } from "astro/config";

// info.sti.care, the static education library (doc 34). Plain static HTML, no
// service worker, no client framework. The one build-time coupling to the app is
// the design tokens: the layout imports passport's design CSS so the pages match
// the product exactly (a single source of truth, never a duplicated palette). That
// import reaches outside this package into the monorepo, so the dev server is
// allowed to read one level up.
export default defineConfig({
  site: "https://info.sti.care",
  vite: {
    server: {
      fs: {
        allow: [".."],
      },
    },
  },
});
