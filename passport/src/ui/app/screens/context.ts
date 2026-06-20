import type { ReactNode } from "react";
import type { Nav } from "../useAppRouter.ts";
import type { RouteData, Screen } from "../routes.ts";
import type { OwnerView, PassportStore } from "../../../store/index.ts";
import type { OnboardingActions } from "../useOnboarding.ts";

// What every routed screen gets: navigation, the owner's derived view, the
// onboarding/login actions, the share-sheet opener, the backend boundary, and
// the current route's payload.
export interface ScreenCtx {
  nav: Nav;
  owner: OwnerView;
  onboarding: OnboardingActions;
  openShare: () => void;
  store: PassportStore;
  data: RouteData | null;
}

export type ScreenRenderer = (ctx: ScreenCtx) => ReactNode;
export type ScreenRenderers = Partial<Record<Screen, ScreenRenderer>>;
