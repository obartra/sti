/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
// Repo-scoped build version (shared with the promises report so they can't drift):
// vMajor.Minor.Patch where the tag is major.minor and the patch is commits-since.
import { repoVersion } from "../deploy/version.mjs";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(repoVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Integration tests boot the Go server and run via vitest.integration.config.ts
    // (npm run test:integration), so they stay out of the default jsdom run.
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      // The pure core stays fully covered; UI is covered by component tests and
      // visual regression, not a line-coverage gate.
      include: ["src/core/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.steps.ts",
        "src/**/*.fixtures.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
