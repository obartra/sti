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
      onClaim={(handle, avatar) => {
        // Create the real account, then show its genuine recovery phrase. Stay
        // put on failure (the hook surfaces the error).
        void onboarding.claim(handle, avatar).then((ok) => {
          if (ok) nav.go("b2-recovery");
        });
      }}
      onLogin={() => void onboarding.loginPasskey()}
      onRecover={(phrase) => void onboarding.recoverPhrase(phrase)}
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
      onEnter={(sharingMode) => void onboarding.finish(sharingMode)}
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
