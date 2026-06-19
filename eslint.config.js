import js from "@eslint/js";
import globals from "globals";

export default [
  // passport/ and server/ are self-contained packages with their own toolchains
  // (tsc, go). Root ESLint only covers the vanilla public/ site and tooling.
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
    // Browser app code (ES modules).
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { caughtErrors: "none", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Node tooling + tests.
    files: ["**/*.mjs", "test/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
