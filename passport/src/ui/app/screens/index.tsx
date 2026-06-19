import type { ReactNode } from "react";
import type { Screen } from "../routes.ts";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";
import { publicRenderers } from "./publicScreens.tsx";
import { onboardRenderers } from "./onboardScreens.tsx";
import { coreRenderers } from "./coreScreens.tsx";
import { reportRenderers } from "./reportScreens.tsx";
import { connectRenderers } from "./connectScreens.tsx";
import { learnRenderers } from "./learnScreens.tsx";
import { circleRenderers } from "./circleScreens.tsx";

const RENDERERS: ScreenRenderers = {
  ...publicRenderers,
  ...onboardRenderers,
  ...coreRenderers,
  ...reportRenderers,
  ...connectRenderers,
  ...learnRenderers,
  ...circleRenderers,
};

// Render the component for the current screen with its wired props. Home is the
// fallback (every real screen is in the map, so the fallback never fires).
export function ScreenView({
  screen,
  ctx,
}: {
  screen: Screen;
  ctx: ScreenCtx;
}): ReactNode {
  const render = RENDERERS[screen] ?? RENDERERS.home;
  return render ? render(ctx) : null;
}
