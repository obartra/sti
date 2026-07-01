import type { ReactNode } from "react";
import type { Screen } from "../routes.ts";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";
import { publicRenderers } from "./publicScreens.tsx";
import { onboardRenderers } from "./onboardScreens.tsx";
import { coreRenderers } from "./coreScreens.tsx";
import { trustRenderers } from "./trustScreens.tsx";
import { reportRenderers } from "./reportScreens.tsx";
import { peopleRenderers } from "./peopleScreens.tsx";
import { linksRenderers } from "./linksScreens.tsx";
import { learnRenderers } from "./learnScreens.tsx";
import { groupRenderers } from "./groupScreens.tsx";

const RENDERERS: ScreenRenderers = {
  ...publicRenderers,
  ...onboardRenderers,
  ...coreRenderers,
  ...trustRenderers,
  ...reportRenderers,
  ...peopleRenderers,
  ...linksRenderers,
  ...learnRenderers,
  ...groupRenderers,
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
