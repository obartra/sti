# Testing strategy

Trust is the product, so behaviour is validated in code at every layer, and the
hard invariants are pinned as executable specs rather than prose. The right test
type lives at the right layer:

## Layers and tools

| Layer                         | What it proves                                                             | Tools                                                                                |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Pure core** (badge, crypto) | The trust invariants hold for the whole input space, not just example rows | Gherkin `.feature` (readable invariants) + **fast-check** (exhaustive) + Vitest unit |
| **Components**                | Each state renders correctly and doesn't visually regress                  | Storybook + Testing Library + **lost-pixel** visual regression                       |
| **Backend**                   | The blind store behaves, and existence-uniformity holds                    | Integration tests against **real SQLite** + a size/timing decoy test                 |
| **End to end** (later)        | Full flows across client + server                                          | Playwright                                                                           |

## Why this shape

- **Invariants as executable specs.** The product is a set of hard rules (the
  two-state badge, the never-splittable umbrella, detectable-HIV-always-gray,
  non-decodable gray). Each is written twice: once as a plain-language Gherkin
  scenario an outside reviewer can read (`src/core/*.feature`), and once as a
  fast-check property that proves it across the entire generated input space
  (`src/core/*.invariants.test.ts`). The scenario documents intent; the property
  is the proof.
- **No large code without validation.** The pure core is held at 100% coverage
  (enforced by Vitest thresholds in `vitest.config.ts`); CI runs `typecheck` +
  `test:cov`. Coverage cannot silently drop.
- **Visual regression is borrowed from `~/repos/centaur`** (its design doc 014):
  Storybook stories per component state, screenshots rendered in the **official
  lost-pixel Docker image** (pinned `linux/amd64`) so pixels are byte-stable
  between local macOS and CI. Baselines are committed under `visual-baselines/`;
  `current/`/`difference/` are gitignored. The merge gate is a diff; a
  `screenshot:update` PR label triggers a job that regenerates baselines and
  commits them back, so reviewers see image changes as binary diffs in "Files
  changed." Per-page absolute-pixel threshold (~50px) for AA noise;
  `prefers-reduced-motion: reduce` for deterministic captures. Wired when the
  component layer lands, not before (nothing to snapshot yet).

## Commands

| Command              | Does                                                |
| -------------------- | --------------------------------------------------- |
| `npm test`           | Run unit + property + Gherkin specs (Vitest)        |
| `npm run test:cov`   | Same, with coverage thresholds enforced             |
| `npm run test:watch` | Watch mode                                          |
| `npm run typecheck`  | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |

## Current state

Increment 1 of the pure core is built and green: badge resolution + the viewer
output, with the invariants pinned. Crypto, the viewer-resolution/existence
layer, and the component + backend layers are next, each with the test type its
row above calls for.
