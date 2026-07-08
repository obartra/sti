import { defineConfig } from "@playwright/test";

// The behavioral plane of the load & usage lab (doc 14 §2). Specs live in e2e/
// (outside src/, so vitest, tsc, and eslint leave them to Playwright's own
// toolchain) and are named *.pw.spec.ts. globalSetup boots ONE throwaway server,
// builds + previews the app pointed at it, and hands the origins to every spec
// (doc 38 §4); specs seed their own data and drive a real browser. Run with
// `npm run test:e2e`; needs Go on PATH and a Playwright browser installed
// (`npx playwright install chromium`).
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/support/globalSetup.ts",
  testMatch: "**/*.pw.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: { headless: true },
});
