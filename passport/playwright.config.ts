import { defineConfig } from "@playwright/test";

// The behavioral plane of the load & usage lab (doc 13 §2). Specs live in e2e/
// (outside src/, so vitest, tsc, and eslint leave them to Playwright's own
// toolchain) and are named *.pw.spec.ts. Each spec boots a throwaway server,
// seeds real data, builds + previews the app pointed at it, and drives a real
// browser. Run with `npm run test:e2e`; needs Go on PATH and a Playwright browser
// installed (`npx playwright install chromium`).
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.pw.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: { headless: true },
});
