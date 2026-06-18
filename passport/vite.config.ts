/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
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
