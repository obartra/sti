import { Library, Detail } from "../../learn/Library.tsx";
import { UU } from "../../learn/UU.tsx";
import type { ScreenRenderers } from "./context.ts";

export const learnRenderers: ScreenRenderers = {
  learn: ({ nav }) => (
    <Library
      onOpenDetail={(id) => nav.go("learn-detail", { id })}
      onOpenUU={() => nav.go("learn-uu")}
    />
  ),
  "learn-detail": ({ nav, data }) => (
    <Detail id={data?.id} onOpenUU={() => nav.go("learn-uu")} />
  ),
  "learn-uu": () => <UU />,
};
