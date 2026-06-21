/**
 * The product-behavior catalog: the full map of behaviors we intend the product
 * to have, grouped by category, each with a status and a `pin` (the test or
 * module that validates it). It is the single source of truth, read two ways:
 *
 * - the meta-tests keep it honest: a behavior pinned in the load lab must be
 *   covered by a tagged test there (likewise the Playwright suite for browser
 *   behaviors), and every behavior's `pin` file must exist, so the catalog can
 *   never name a vanished suite or claim coverage it does not have;
 * - `deploy/build-behaviors.mjs` renders the same JSON into the grouped report at
 *   `/behaviors`, the way `build-promises.mjs` renders the Gherkin.
 *
 * `pin` is a repo path (relative to passport/): the load-lab gate
 * (`src/loadlab/loadlab.integration.test.ts`), the Playwright gate
 * (`e2e/resolution.pw.spec.ts`), the stress module for characterized measures
 * (`src/loadlab/stress.ts`), or a unit/integration/Go suite that owns the
 * behavior (e.g. `src/crypto/payload.test.ts`, `../server/.../notify_test.go`).
 *
 * Status meaning:
 * - `validated`: a passing test pins it.
 * - `characterized`: measured and reported, not yet a pass/fail gate.
 * - `planned`: intended, no test yet.
 */
import data from "./behaviors.json";

export type BehaviorStatus = "validated" | "characterized" | "planned";
export type BehaviorLayer =
  | "wire"
  | "crypto"
  | "telemetry"
  | "lifecycle"
  | "browser";

export interface Behavior {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly intent: string;
  readonly check: string;
  readonly status: BehaviorStatus;
  readonly layer: BehaviorLayer;
  readonly docRef: string;
  /** Repo path (relative to passport/) of the test or module that validates it. */
  readonly pin: string;
}

/** The load-lab and Playwright gate files, used by the meta-tests to know which
 * behaviors each suite owns and must cover. */
export const LOADLAB_PIN = "src/loadlab/loadlab.integration.test.ts";
export const E2E_PIN = "e2e/resolution.pw.spec.ts";

export const BEHAVIORS = data as unknown as readonly Behavior[];

export const STATUSES: readonly BehaviorStatus[] = [
  "validated",
  "characterized",
  "planned",
];

export const LAYERS: readonly BehaviorLayer[] = [
  "wire",
  "crypto",
  "telemetry",
  "lifecycle",
  "browser",
];

// Display + grouping order, roughly most trust-critical first.
export const CATEGORY_ORDER: readonly string[] = [
  "Privacy & existence-uniformity",
  "Trust integrity & sharing",
  "Account & recovery",
  "Durability & consistency",
  "Access control",
  "Fairness & abuse resistance",
  "Knocks & grants",
  "Degradation & capacity",
  "Observability integrity",
  "Notifications & wakes",
  "Lifecycle & data isolation",
  "Client behavior",
];

/** Look up a behavior by id, throwing if it is not in the catalog. */
export function behavior(id: string): Behavior {
  const b = BEHAVIORS.find((x) => x.id === id);
  if (b === undefined) throw new Error(`unknown behavior id: ${id}`);
  return b;
}
