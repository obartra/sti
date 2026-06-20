import type { ReactNode } from "react";
import type { Nav } from "../useAppRouter.ts";
import type { RouteData, Screen } from "../routes.ts";
import type { OwnerView, PassportStore } from "../../../store/index.ts";
import type { OnboardingActions } from "../useOnboarding.ts";
import type { ReportOutcome } from "../../../core/report.ts";
import type { OwnerState } from "../../../core/badge.ts";

// What every routed screen gets: navigation, the owner's derived view, the raw
// owner state + its setter (for settings), the onboarding/login actions, the
// report-result action, the share-sheet opener, the backend boundary, and the
// current route's payload.
export interface ScreenCtx {
  nav: Nav;
  owner: OwnerView;
  /** The owner's raw badge inputs, for settings screens to read and edit. */
  ownerState: OwnerState;
  onboarding: OnboardingActions;
  /** Apply a reported test result to the owner's state (logged-in only). */
  onReport: (outcome: ReportOutcome) => void;
  /**
   * Apply an update to the owner state and republish (logged-in only). Takes an
   * updater (not a value) so concurrent edits compose against the latest state.
   */
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  openShare: () => void;
  /** Permanently delete the account and return to the logged-out landing. */
  onDeleteAccount: () => void;
  /** Count of current knocks across the owner's aliases (contentless; 0 logged out). */
  knockCount: number;
  /** Re-pull the knock count (e.g. when the inbox opens). */
  refreshKnocks: () => void;
  store: PassportStore;
  data: RouteData | null;
}

export type ScreenRenderer = (ctx: ScreenCtx) => ReactNode;
export type ScreenRenderers = Partial<Record<Screen, ScreenRenderer>>;
