import { Landing } from "../../public/Landing.tsx";
import { PublicResolution } from "../../public/PublicResolution.tsx";
import { Alert } from "../../public/Alert.tsx";
import { SAMPLE_RESOLVED } from "../fixtures.ts";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";

function selfCard(ctx: ScreenCtx) {
  const { owner } = ctx;
  return {
    state: owner.viewerBadge,
    labels: owner.labels,
    route: owner.blueRoute,
    identity: { handle: owner.handle },
  };
}

export const publicRenderers: ScreenRenderers = {
  "a1-landing": ({ nav }) => (
    <Landing
      onClaim={() => nav.go("b1-claim")}
      onSample={() => nav.go("a2-public")}
      onLogin={() => nav.go("b1-claim", { isLogin: true })}
    />
  ),
  "a2-public": (ctx) => {
    const self = ctx.data?.self ?? false;
    return (
      <PublicResolution
        resolved={self ? selfCard(ctx) : SAMPLE_RESOLVED}
        self={self}
        onBack={ctx.nav.back}
        onClaim={() => ctx.nav.go("b1-claim")}
        onVerify={() => ctx.nav.go("learn")}
      />
    );
  },
  "a3-alert": ({ nav, data }) => (
    <Alert preview={data?.preview ?? false} onBack={nav.back} />
  ),
};
