import type { ReactNode } from "react";
import type { Nav } from "../useAppRouter.ts";
import type { OwnerFixture } from "../fixtures.ts";
import type { RouteData, Screen } from "../routes.ts";

// What every routed screen gets: navigation, the demo owner state, the
// share-sheet opener, and the current route's payload (article id, flags).
export interface ScreenCtx {
  nav: Nav;
  owner: OwnerFixture;
  openShare: () => void;
  data: RouteData | null;
}

export type ScreenRenderer = (ctx: ScreenCtx) => ReactNode;
export type ScreenRenderers = Partial<Record<Screen, ScreenRenderer>>;
