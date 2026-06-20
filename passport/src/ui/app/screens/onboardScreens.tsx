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
  "b1-claim": ({ nav, data }) => (
    <Claim
      isLogin={data?.isLogin ?? false}
      onBack={nav.back}
      onContinue={() => nav.go("b2-recovery")}
      onEnter={() => nav.jump("home")}
    />
  ),
  "b2-recovery": ({ nav }) => (
    <Recovery onBack={nav.back} onContinue={() => nav.go("b3-setup")} />
  ),
  "b3-setup": ({ nav }) => (
    <FirstRunSetup onBack={nav.back} onEnter={() => nav.jump("home")} />
  ),
  "avatar-edit": ({ nav, owner }) => (
    <AvatarEditRoute nav={nav} avatar={owner.avatar} />
  ),
};
