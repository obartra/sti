/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

// Integration tests run the real Go blind store and talk to it over HTTP, so
// they need the node environment, real timers, and Go on PATH (or
// STI_API_BASE_URL pointing at a running instance). Kept separate from the
// default jsdom unit run; CI runs this in a job that has both Node and Go.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // Building and booting the server is slower than a unit test.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
