import { Promises } from "../../promises/Promises.tsx";
import { TrustShell } from "../../trust/TrustShell.tsx";
import { LegalPage } from "../../trust/LegalPage.tsx";
import { PRIVACY_POLICY, TERMS } from "../../trust/trustCopy.ts";
import { Feedback } from "../../trust/Feedback.tsx";
import { ShareLinkPage } from "../../findable/ShareLinkPage.tsx";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";

// The public trust pages (doc 23): promises, privacy, terms, and the "share your
// link" guide (docs 16, 17). Each is full-page static content wrapped in TrustShell
// (a back control + a sticky section rail on large screens + the shared footer), and
// each rail/footer link routes to a sibling so the set is reachable from any of them.

// Exported so a test can pin that each footer link targets a real screen id (an id
// in ALL_SCREENS), not a typo that would route nowhere (G16).
export function footerLinks(nav: ScreenCtx["nav"]): {
  onPromises: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
  onShareLink: () => void;
  onFeedback: () => void;
} {
  return {
    onPromises: () => nav.go("promises"),
    onPrivacy: () => nav.go("privacy-policy"),
    onTerms: () => nav.go("terms"),
    onShareLink: () => nav.go("share-link"),
    onFeedback: () => nav.go("feedback"),
  };
}

export const trustRenderers: ScreenRenderers = {
  promises: ({ nav }) => (
    <TrustShell
      current="promises"
      onBack={nav.back}
      wideContent
      {...footerLinks(nav)}
    >
      <Promises />
    </TrustShell>
  ),
  "privacy-policy": ({ nav }) => (
    <TrustShell
      current="privacy"
      onBack={nav.back}
      wideContent
      {...footerLinks(nav)}
    >
      <LegalPage doc={PRIVACY_POLICY} />
    </TrustShell>
  ),
  terms: ({ nav }) => (
    <TrustShell
      current="terms"
      onBack={nav.back}
      wideContent
      {...footerLinks(nav)}
    >
      <LegalPage doc={TERMS} />
    </TrustShell>
  ),
  "share-link": ({ nav, vanityName, isLoggedIn }) => (
    <TrustShell
      current="share-link"
      onBack={nav.back}
      wideContent
      {...footerLinks(nav)}
    >
      <ShareLinkPage
        handle={
          isLoggedIn && vanityName != null && vanityName !== ""
            ? vanityName
            : undefined
        }
      />
    </TrustShell>
  ),
  // The "Something wrong?" form (doc 34): the same trust shell, no rail item lit,
  // wired to the store's public feedback intake.
  feedback: ({ nav, store }) => (
    <TrustShell onBack={nav.back} {...footerLinks(nav)}>
      <Feedback
        submit={(reason, body) => store.submitFeedback(reason, body)}
        onClose={nav.back}
      />
    </TrustShell>
  ),
};
