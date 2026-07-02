import js from "@eslint/js";
import globals from "globals";

export default [
  // passport/ and server/ are self-contained packages with their own toolchains
  // (tsc, go). Root ESLint only covers the node tooling and tests.
  {
    ignores: [
      "node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "passport/**",
      "server/**",
      // labs is a throwaway prototype renderer, not production code.
      "labs/**",
    ],
  },
  js.configs.recommended,
  {
    // Node tooling + tests.
    files: ["**/*.mjs", "test/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    // CJS tooling (the info site's lost-pixel config). Runs under node; its
    // beforeScreenshot callback executes inside the captured page, hence the
    // browser globals.
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
