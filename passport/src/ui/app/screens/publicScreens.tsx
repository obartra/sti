import { Landing } from "../../public/Landing.tsx";
import { PublicResolution } from "../../public/PublicResolution.tsx";
import { PublicResolutionScreen } from "../../public/PublicResolutionScreen.tsx";
import { SelfPreview } from "../../public/SelfPreview.tsx";
import { Alert } from "../../public/Alert.tsx";
import { Exposed } from "../../public/Exposed.tsx";
import { SAMPLE_RESOLVED } from "../fixtures.ts";
import type { ScreenRenderers } from "./context.ts";

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

    // Self-preview ("what others see"): per alias (doc 15). The owner picks which
    // link to preview and sees the exact face it resolves to, computed locally.
    if (ctx.data?.self) {
      return (
        <SelfPreview
          aliases={ctx.aliases}
          state={ctx.ownerState}
          accountHandle={ctx.owner.handle}
          onBack={ctx.nav.back}
          onClaim={onClaim}
          onVerify={onVerify}
        />
      );
    }

    // A real shared link: resolve the id + key against the backend. If the link is
    // a contact invite (it carried a notify capability) and the viewer is logged
    // in, offer "Add to contacts" instead of a knock.
    const { id, key, notify, ref } = ctx.data ?? {};
    if (id !== undefined && key !== undefined) {
      const invite =
        ctx.isLoggedIn && notify !== undefined
          ? {
              alias: { id, key },
              notify,
              ...(ref !== undefined ? { ref } : {}),
            }
          : undefined;
      return (
        <PublicResolutionScreen
          store={ctx.store}
          link={{ id, key }}
          invite={invite}
          onAcceptInvite={ctx.onAcceptContactInvite}
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
  exposed: ({ nav }) => <Exposed onClaim={() => nav.go("b1-claim")} />,
};
