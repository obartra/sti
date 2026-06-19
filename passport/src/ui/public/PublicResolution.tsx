import { useState } from "react";
import {
  type BadgeState,
  type ProtectionLabel,
  type Route,
} from "../badge-card.tsx";
import {
  BackBar,
  SelfBanner,
  ResolvedBadge,
  SharedSummary,
  KnockSection,
  ColdActions,
} from "./PublicResolution.parts.tsx";
import { Explainer } from "./PublicResolution.explainer.tsx";

// A2 public resolution. Faithful port of public.jsx PublicCard. Copy verbatim
// from copy.js (publicCard). The viewer renders a resolved card, or the uniform
// gray-nothing (resolved=null), identical for an unauthorized viewer and a
// nonexistent alias. Knock + claim/verify affordances appear only where the
// design shows them; the cold gray-nothing stays button-free (invariant 6).

export interface ResolvedView {
  state: BadgeState;
  labels?: ProtectionLabel[];
  route?: Route;
  identity: { handle: string };
  avatarSrc?: string;
}

export interface PublicResolutionProps {
  // The resolved card, or null for the uniform gray-nothing (no key /
  // nonexistent), which renders identically either way.
  resolved: ResolvedView | null;
  // Self-preview ("this is what others see"); no claim/verify CTAs.
  self?: boolean;
  // Arrived via the shared link: only this viewer gets the knock affordance on
  // gray-nothing. A cold/guessed open never reaches it.
  linkHolder?: boolean;
  initialKnockSent?: boolean;
  onBack?: () => void;
  onClaim?: () => void;
  onVerify?: () => void;
  onKnock?: () => void;
}

export function PublicResolution({
  resolved,
  self = false,
  linkHolder = false,
  initialKnockSent = false,
  onBack,
  onClaim,
  onVerify,
  onKnock,
}: PublicResolutionProps) {
  const [knockSent, setKnockSent] = useState(initialKnockSent);
  const doKnock = () => {
    onKnock?.();
    setKnockSent(true);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <BackBar onBack={onBack} />

      {self && <SelfBanner />}

      <ResolvedBadge resolved={resolved} />

      {resolved && <SharedSummary />}

      {resolved && <Explainer />}

      <KnockSection
        linkHolder={linkHolder}
        knockSent={knockSent}
        onKnock={doKnock}
        onBack={onBack}
      />

      {/* Cold resolved-for-stranger only. Gray-nothing stays button-free. */}
      {!self && resolved && (
        <ColdActions onClaim={onClaim} onVerify={onVerify} />
      )}
    </div>
  );
}
