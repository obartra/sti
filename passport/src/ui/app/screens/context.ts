import type { ReactNode } from "react";
import type { Nav } from "../useAppRouter.ts";
import type { OwnerFixture } from "../fixtures.ts";
import type { RouteData, Screen } from "../routes.ts";
import type { PassportStore } from "../../../store/index.ts";

// What every routed screen gets: navigation, the demo owner state, the
// share-sheet opener, the backend boundary, and the current route's payload.
export interface ScreenCtx {
  nav: Nav;
  owner: OwnerFixture;
  openShare: () => void;
  store: PassportStore;
  data: RouteData | null;
}

export type ScreenRenderer = (ctx: ScreenCtx) => ReactNode;
export type ScreenRenderers = Partial<Record<Screen, ScreenRenderer>>;
