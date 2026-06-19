import { Landing } from "../../public/Landing.tsx";
import { PublicResolution } from "../../public/PublicResolution.tsx";
import { PublicResolutionScreen } from "../../public/PublicResolutionScreen.tsx";
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
    const onClaim = () => ctx.nav.go("b1-claim");
    const onVerify = () => ctx.nav.go("learn");

    // Self-preview ("what others see"): the owner's own card, computed locally.
    if (ctx.data?.self) {
      return (
        <PublicResolution
          resolved={selfCard(ctx)}
          self
          onBack={ctx.nav.back}
          onClaim={onClaim}
          onVerify={onVerify}
        />
      );
    }

    // A real shared link: resolve the id + key against the backend.
    const { id, key } = ctx.data ?? {};
    if (id !== undefined && key !== undefined) {
      return (
        <PublicResolutionScreen
          store={ctx.store}
          link={{ id, key }}
          onBack={ctx.nav.back}
          onClaim={onClaim}
          onVerify={onVerify}
        />
      );
    }

    // No link (the landing's "see a sample" demo): a fixture card.
    return (
      <PublicResolution
        resolved={SAMPLE_RESOLVED}
        onBack={ctx.nav.back}
        onClaim={onClaim}
        onVerify={onVerify}
      />
    );
  },
  "a3-alert": ({ nav, data }) => (
    <Alert preview={data?.preview ?? false} onBack={nav.back} />
  ),
};
