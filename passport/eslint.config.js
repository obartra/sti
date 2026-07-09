import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import globals from "globals";

// Code-quality metrics. The implementation is held to real ceilings, but the
// signals are not equal in weight:
//
//   - Cyclomatic `complexity` is the PRIMARY structural gate. It measures the
//     branching that actually makes a function hard to read, test, and audit,
//     which is the thing worth decomposing. The implementation lives right at
//     this ceiling in a handful of places (parsers, a few screens), so it earns
//     its keep; a function that trips it is genuinely doing too much.
//   - `max-lines-per-function` and `max-lines` guard sprawl, the other real
//     smell, independent of branching.
//   - `max-depth`, `max-params`, and `max-nested-callbacks` are cheap guards
//     that rarely bind but catch specific messes when they do.
//   - `max-statements` is DELIBERATELY a loose backstop, not a co-equal gate.
//     Statement count is a coarse proxy already subsumed by complexity + length:
//     a linear routine (envelope serialize/deserialize, a membership walk, a key
//     rotation) can run many sequential statements at complexity ~1 and read
//     perfectly, yet a tight statement ceiling would push it to split for no
//     gain. So it is set high enough to fire only on pathological sprawl the
//     length and complexity gates somehow missed, letting cyclomatic complexity
//     carry the "this function does too much" judgment.
//
// One ceiling set applies everywhere by design: severity is NOT tiered by
// directory. Per-dir numeric tiers were considered and rejected: the code
// already lives at the complexity ceiling in security-sensitive parsers, so a
// stricter tier there would force churn-y refactors with no evidence of benefit,
// and a looser tier elsewhere would just erode the gate. Where a ceiling truly
// does not apply, it is relaxed per-FILE with a stated reason (the blocks
// below), never per-directory. Those overrides are blameless: each names why the
// length is inherent (generated icons, a static wordlist, enumerated story
// states, accreted spec assertions), not a smell being waved through. A new
// override belongs there only if it can state the same kind of reason.
const QUALITY_RULES = {
  complexity: ["error", 12],
  "max-depth": ["error", 4],
  "max-params": ["error", 4],
  // Loose backstop, not a primary gate (see the note above): cyclomatic
  // complexity and per-function length do the real structural work.
  "max-statements": ["error", 25],
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

// Files legitimately over the 400 effective-line ceiling, each PINNED at its
// measured size with a stated reason. Function-level ceilings land on the code
// being written and force decomposition of the new thing, which is the
// productive kind of friction; the FILE ceiling lands on whoever edits an
// accreted file last, and the cheapest fix is compressing untouched code,
// which is diff noise, not quality. So the file ceiling gets this escape
// valve: a pinned file still cannot grow past its pin (lower the pin when a
// file shrinks), and adding a pin is an explicit, reviewed act with a reason.
// Never satisfy a size gate by reformatting code you are not otherwise
// touching; split what you are adding, or pin the file here.
const PINNED_LINES = [
  // Aggregator files that grow one entry per contact feature (a schema field, a
  // controller method). The new code belongs in these files; the owner-actions
  // hook was instead SPLIT (useContactActions.ts) when it grew, which is the
  // preferred fix where a clean seam exists.
  {
    file: "src/store/accountBlob.ts",
    max: 401,
    reason: "the account schema + codec; one field/validator per data slice",
  },
  {
    file: "src/store/session.ts",
    max: 419,
    reason: "the controller dispatch table; one thin method per capability",
  },
];

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
      // Playwright behavioral specs + config: outside src/ and tsconfig, checked
      // by Playwright's own toolchain (npm run test:e2e), not this lint pass.
      "e2e/**",
      "playwright.config.ts",
      // Generated native shells (Capacitor, doc 26): Xcode and Gradle projects
      // plus the copied web bundle under their public dirs. Not our source to
      // lint; they have their own toolchains (xcodebuild, gradle).
      "ios/**",
      "android/**",
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

  // The pinned over-ceiling files (see PINNED_LINES above): each keeps the
  // max-lines gate, just at its pinned size, so it cannot grow further.
  ...PINNED_LINES.map(({ file, max }) => ({
    files: [file],
    rules: {
      "max-lines": ["error", { max, skipBlankLines: true, skipComments: true }],
    },
  })),

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

  // A static wordlist data table (doc 15 pseudonym lists): one entry per line, sized
  // for unlinkability, so the length is the data, not complexity.
  {
    files: ["src/lib/pseudonymWords.ts"],
    rules: {
      "max-lines": "off",
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

  // Node tooling scripts (e.g. PWA icon generation): plain ESM run under Node,
  // outside src/ and tsconfig, so they get node globals and no type-aware rules.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
);
