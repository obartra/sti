import { useState, type ReactNode } from "react";
import {
  type BadgeState,
  type ProtectionLabel,
  type Route,
} from "../badge-card.tsx";
import type { AvatarConfig } from "../../lib/avatars.ts";
import {
  BackBar,
  SelfBanner,
  ResolvedBadge,
  SharedSummary,
  ResolutionActions,
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
  /** The owner's chosen avatar (doc 13), rendered into the card; a card without one
   * (a v1 payload) falls back to the handle-derived avatar. */
  avatar?: AvatarConfig;
  avatarSrc?: string;
}

export interface PublicResolutionProps {
  // The resolved card, or null for the uniform gray-nothing (no key /
  // nonexistent), which renders identically either way.
  resolved: ResolvedView | null;
  // Self-preview ("this is what others see"); no claim/verify CTAs.
  self?: boolean;
  // Optional control rendered under the self banner (the per-alias face picker,
  // doc 15): lets the owner preview the face each of their links resolves to.
  picker?: ReactNode;
  // Arrived via the shared link: only this viewer gets the knock affordance on
  // gray-nothing. A cold/guessed open never reaches it.
  linkHolder?: boolean;
  initialKnockSent?: boolean;
  // A logged-in viewer opening a contact invite can add the inviter as a two-way
  // contact instead of knocking. onAccept resolves with the return link to share.
  canAccept?: boolean;
  onAccept?: ((label: string) => Promise<string>) | undefined;
  onBack?: () => void;
  onClaim?: () => void;
  onVerify?: () => void;
  onKnock?: () => void;
}

export function PublicResolution({
  resolved,
  self = false,
  picker,
  linkHolder = false,
  initialKnockSent = false,
  canAccept = false,
  onAccept,
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
      {self && picker}

      <ResolvedBadge resolved={resolved} />

      {resolved && <SharedSummary />}

      {resolved && <Explainer />}

      <ResolutionActions
        self={self}
        resolved={resolved}
        linkHolder={linkHolder}
        knockSent={knockSent}
        canAccept={canAccept}
        onAccept={onAccept}
        onKnock={doKnock}
        onBack={onBack}
        onClaim={onClaim}
        onVerify={onVerify}
      />
    </div>
  );
}
