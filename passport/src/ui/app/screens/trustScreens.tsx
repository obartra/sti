import { Promises } from "../../promises/Promises.tsx";
import { TrustPage } from "../../trust/TrustPage.tsx";
import { LegalPage } from "../../trust/LegalPage.tsx";
import { PRIVACY_POLICY, TERMS } from "../../trust/trustCopy.ts";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";

// The public trust pages (doc 23): promises, privacy, and terms. Each is full-page
// static content wrapped in TrustPage (a back control + the shared footer), and
// each footer link routes to a sibling so the set is reachable from any of them.

// Exported so a test can pin that each footer link targets a real screen id (an id
// in ALL_SCREENS), not a typo that would route nowhere (G16).
export function footerLinks(nav: ScreenCtx["nav"]): {
  onPromises: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
} {
  return {
    onPromises: () => nav.go("promises"),
    onPrivacy: () => nav.go("privacy-policy"),
    onTerms: () => nav.go("terms"),
  };
}

export const trustRenderers: ScreenRenderers = {
  promises: ({ nav }) => (
    <TrustPage onBack={nav.back} wide {...footerLinks(nav)}>
      <Promises />
    </TrustPage>
  ),
  "privacy-policy": ({ nav }) => (
    <TrustPage onBack={nav.back} wide {...footerLinks(nav)}>
      <LegalPage doc={PRIVACY_POLICY} />
    </TrustPage>
  ),
  terms: ({ nav }) => (
    <TrustPage onBack={nav.back} wide {...footerLinks(nav)}>
      <LegalPage doc={TERMS} />
    </TrustPage>
  ),
};
