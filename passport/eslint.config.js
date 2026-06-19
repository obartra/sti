import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import globals from "globals";

// Code-quality metrics. The implementation is held to real ceilings: branching
// complexity, nesting, parameter count, statement count, and file/function
// length. Screens that outgrow these get decomposed, not exempted. Generated
// (icons), vendored (design tokens), story, and test files relax the
// length/statement ceilings below, where length is inherent, not a smell.
const QUALITY_RULES = {
  complexity: ["error", 12],
  "max-depth": ["error", 4],
  "max-params": ["error", 4],
  "max-statements": ["error", 15],
  "max-nested-callbacks": ["error", 3],
  "max-lines": [
    "error",
    { max: 400, skipBlankLines: true, skipComments: true },
  ],
  "max-lines-per-function": [
    "error",
    { max: 120, skipBlankLines: true, skipComments: true },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "storybook-static/**",
      "html/**",
      ".lostpixel/**",
      "visual-baselines/**",
      "node_modules/**",
      // Vendored verbatim copy of the prototype/design bundle, for reference
      // only; not our code to lint.
      "comps-reference/**",
    ],
  },

  js.configs.recommended,

  // Typed lint for the implementation. strictTypeChecked + stylisticTypeChecked
  // give us real type-aware rules (no floating promises, no unsafe any, no
  // needless conditions) on top of TS strict mode.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // TypeScript already resolves identifiers; core no-undef only produces
      // false positives on type-only and ambient references.
      "no-undef": "off",
      // Arrow-shorthand event handlers (onClick={() => setOpen(true)}) are
      // idiomatic React; keep the rule for genuinely confusing void returns.
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      // Interpolating a number or boolean into a template is fine; the rule
      // still catches objects, any, and nullish.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      ...QUALITY_RULES,
    },
  },

  // Auto-generated from the design bundle: not hand-maintained, so length and
  // statement ceilings do not apply.
  {
    files: ["src/design/icons.tsx"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
    },
  },

  // Stories enumerate every component state; the length is the point.
  {
    files: ["**/*.stories.{ts,tsx}"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
    },
  },

  // Specs accrue assertions; length/nesting there is coverage, not a smell.
  {
    files: ["**/*.test.{ts,tsx}", "src/**/*.feature.test.ts"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-nested-callbacks": "off",
    },
  },

  // Storybook authoring rules for stories + the .storybook config.
  ...storybook.configs["flat/recommended"],

  // Storybook config/support is TS/TSX but lives outside tsconfig's include, so
  // lint it with the TS parser but without type-aware rules.
  {
    files: [".storybook/**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { react },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat["jsx-runtime"].rules,
      "no-undef": "off",
    },
  },

  // Plain JS/CJS tooling files (eslint + lostpixel config); no TS parser needed.
  {
    files: ["*.{js,cjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
);
