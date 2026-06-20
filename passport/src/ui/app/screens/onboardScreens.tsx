import { useState } from "react";
import { Claim } from "../../onboarding/Claim.tsx";
import { Recovery } from "../../onboarding/Recovery.tsx";
import { FirstRunSetup } from "../../onboarding/FirstRunSetup.tsx";
import { AvatarEdit } from "../../onboarding/AvatarEdit.tsx";
import type { AvatarConfig } from "../../../lib/avatars.ts";
import type { Nav } from "../useAppRouter.ts";
import type { ScreenRenderers } from "./context.ts";

// Avatar edit owns local config state, so it is a component, not an inline arrow.
// It opens on the owner's current avatar.
function AvatarEditRoute({ nav, avatar }: { nav: Nav; avatar: AvatarConfig }) {
  const [config, setConfig] = useState<AvatarConfig>(avatar);
  return <AvatarEdit config={config} onChange={setConfig} onDone={nav.back} />;
}

export const onboardRenderers: ScreenRenderers = {
  "b1-claim": ({ nav, data, onboarding }) => (
    <Claim
      isLogin={data?.isLogin ?? false}
      busy={onboarding.busy}
      error={onboarding.error}
      onBack={nav.back}
      onClaim={(handle, avatar) => {
        // Create the real account, then show its genuine recovery phrase. Stay
        // put on failure (the hook surfaces the error).
        void onboarding.claim(handle, avatar).then((ok) => {
          if (ok) nav.go("b2-recovery");
        });
      }}
      onLogin={() => void onboarding.loginPasskey()}
    />
  ),
  "b2-recovery": ({ nav, onboarding }) => (
    <Recovery
      phrase={onboarding.recoveryPhrase ?? ""}
      onBack={nav.back}
      onContinue={() => nav.go("b3-setup")}
    />
  ),
  "b3-setup": ({ nav, onboarding }) => (
    <FirstRunSetup
      busy={onboarding.busy}
      error={onboarding.error}
      onBack={nav.back}
      onEnter={(sharingMode) => void onboarding.finish(sharingMode)}
    />
  ),
  "avatar-edit": ({ nav, owner }) => (
    <AvatarEditRoute nav={nav} avatar={owner.avatar} />
  ),
};
