/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// Repo-scoped version, derived at build time. `git describe` reports the nearest
// tag plus commits-since plus the short sha, so once a release is tagged (e.g.
// v0.3.0) the stamp reads as semver and falls back to the short sha until then.
// One version for the whole repo, covering both the backend and the frontend.
function repoVersion(): string {
  try {
    return execSync("git describe --tags --always --dirty", {
      encoding: "utf8",
    }).trim();
  } catch {
    return "dev";
  }
}

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
