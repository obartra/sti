import { Landing } from "../../public/Landing.tsx";
import { PublicResolution } from "../../public/PublicResolution.tsx";
import { PublicResolutionScreen } from "../../public/PublicResolutionScreen.tsx";
import { Requests } from "../../public/Requests.tsx";
import { SelfPreview } from "../../public/SelfPreview.tsx";
import { Alert } from "../../public/Alert.tsx";
import { Exposed } from "../../public/Exposed.tsx";
import { FindableResolve } from "../../findable/FindableResolve.tsx";
import { SAMPLE_RESOLVED } from "../fixtures.ts";
import type { ScreenRenderers } from "./context.ts";

export const publicRenderers: ScreenRenderers = {
  "a1-landing": ({ nav, pendingRequests, onTryDemo }) => (
    <Landing
      onClaim={() => nav.go("b1-claim")}
      onSample={onTryDemo}
      onLogin={() => nav.go("b1-claim", { isLogin: true })}
      onPromises={() => nav.go("promises")}
      onPrivacyPolicy={() => nav.go("privacy-policy")}
      onTerms={() => nav.go("terms")}
      pendingCount={pendingRequests.length}
      onRequests={() => nav.go("requests")}
      onShareLink={() => nav.go("share-link")}
    />
  ),
  requests: ({ nav, store, pendingRequests, onForgetRequest }) => (
    <Requests
      requests={pendingRequests}
      resolve={(id) => store.redeemGrant(id)}
      onOpen={(id) => nav.go("a2-public", { id })}
      onForget={onForgetRequest}
      onBack={nav.back}
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

    // A real shared link: resolve the id (+ key) against the backend. A keyed link
    // (`#k=`) can decrypt directly; a keyless id — a Findable name resolved via
    // u-resolve — has no key, so resolveAlias yields gray-nothing and the screen
    // shows the knock affordance (the gated path). If the link is a contact invite
    // (it carried a notify capability) and the viewer is logged in, offer to link:
    // a fresh invite offers "Add to contacts", and a RETURN link (it carries `ref`)
    // offers a one-tap "Connect" that completes the two-way link. An invite always
    // carries a key.
    const { id, key, notify, ref, name } = ctx.data ?? {};
    if (id !== undefined) {
      const invite =
        ctx.isLoggedIn && key !== undefined && notify !== undefined
          ? {
              alias: { id, key },
              notify,
              ...(ref !== undefined ? { ref } : {}),
            }
          : undefined;
      return (
        <PublicResolutionScreen
          store={ctx.store}
          link={{ id, key: key ?? "" }}
          invite={invite}
          onAcceptInvite={ctx.onAcceptContactInvite}
          onIngestReturn={ctx.onIngestContactReturn}
          onBack={ctx.nav.back}
          onClaim={onClaim}
          onVerify={onVerify}
          // Only a findable-name arrival carries `name`, which turns on the report
          // affordance; a keyed/sample link leaves it undefined.
          name={name}
          reportName={
            name !== undefined
              ? (n, reason) => ctx.store.reportVanityName(n, reason)
              : undefined
          }
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
  // Findable resolve→knock (doc 17, F5b): look the name up, then hand the alias id
  // into the keyless knock flow (a2-public renders the "ask to view" affordance).
  "u-resolve": (ctx) => {
    const name = ctx.data?.name ?? "";
    return (
      <FindableResolve
        name={name}
        resolve={(n) => ctx.store.resolveVanityName(n)}
        // Carry the name into the knock screen so the viewer can report it there.
        onResolved={(aliasId) => ctx.nav.go("a2-public", { id: aliasId, name })}
        onClaim={() => ctx.nav.go("b1-claim")}
        onBack={ctx.nav.back}
      />
    );
  },
};
