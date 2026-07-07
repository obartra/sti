import { useState } from "react";
import { Claim } from "../../onboarding/Claim.tsx";
import { Recovery } from "../../onboarding/Recovery.tsx";
import { FirstRunSetup } from "../../onboarding/FirstRunSetup.tsx";
import { AvatarEdit } from "../../onboarding/AvatarEdit.tsx";
import type { AvatarConfig } from "../../../lib/avatars.ts";
import type { Nav } from "../useAppRouter.ts";
import type { ScreenRenderers } from "./context.ts";

// Avatar edit owns local config state, so it is a component, not an inline arrow.
// It opens on the owner's current avatar and persists the pick on Done.
function AvatarEditRoute({
  nav,
  avatar,
  onSetAvatar,
}: {
  nav: Nav;
  avatar: AvatarConfig;
  onSetAvatar: (avatar: AvatarConfig) => void;
}) {
  const [config, setConfig] = useState<AvatarConfig>(avatar);
  return (
    <AvatarEdit
      config={config}
      onChange={setConfig}
      onDone={() => {
        onSetAvatar(config);
        nav.back();
      }}
    />
  );
}

export const onboardRenderers: ScreenRenderers = {
  "b1-claim": ({
    nav,
    data,
    onboarding,
    keepSignedIn,
    onKeepSignedInChange,
  }) => (
    <Claim
      isLogin={data?.isLogin ?? false}
      busy={onboarding.busy}
      error={onboarding.error}
      onBack={nav.back}
      keepSignedIn={keepSignedIn}
      onKeepSignedInChange={onKeepSignedInChange}
      onSwitchMode={() =>
        nav.go("b1-claim", { isLogin: !(data?.isLogin ?? false) })
      }
      onClaim={async (handle, avatar, recovery) => {
        // Create the real account, then show its genuine recovery phrase. When a
        // Username + password was chosen it is wrapped at sign-up (doc 32). A taken
        // Username never blocks the account: the create screen keeps the owner on
        // this step to retry or skip, and advancing is its call via the result.
        const result = await onboarding.claim(handle, avatar, recovery);
        // Advance once the account exists and the optional password either landed or
        // was not attempted; a Username still to resolve keeps us here.
        if (
          result.created &&
          result.recoveryOutcome !== "nameUnavailable" &&
          result.recoveryOutcome !== "weakPassword" &&
          result.recoveryOutcome !== "error"
        ) {
          nav.go("b2-recovery");
        }
        return result;
      }}
      onLogin={() => void onboarding.loginPasskey()}
      onRecover={(phrase) => void onboarding.recoverPhrase(phrase)}
      onRecoverPassword={(name, password) =>
        void onboarding.recoverPassword(name, password)
      }
    />
  ),
  "b2-recovery": ({ nav, onboarding }) => (
    <Recovery
      phrase={onboarding.recoveryPhrase ?? ""}
      onBack={nav.back}
      onContinue={() => nav.go("b3-setup")}
    />
  ),
  "b3-setup": ({ nav, onboarding, keepSignedIn, onKeepSignedInChange }) => (
    <FirstRunSetup
      busy={onboarding.busy}
      error={onboarding.error}
      onBack={nav.back}
      onEnter={() => void onboarding.finish()}
      keepSignedIn={keepSignedIn}
      onKeepSignedInChange={onKeepSignedInChange}
      onViewPrivacyPolicy={() => nav.go("privacy-policy")}
      onViewTerms={() => nav.go("terms")}
    />
  ),
  "avatar-edit": ({ nav, owner, onSetAvatar }) => (
    <AvatarEditRoute
      nav={nav}
      avatar={owner.avatar}
      onSetAvatar={onSetAvatar}
    />
  ),
};
