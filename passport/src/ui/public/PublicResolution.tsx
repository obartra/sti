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
import type { AcceptReveal } from "./PublicResolution.accept.tsx";
import "./public-resolution.css";

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
  /** The epoch day a BLUE card's freshness lapses (last panel + the testing window).
   * Present only on blue cards; it is what lets a viewer fail a stale blue closed to
   * gray at read time, so a passive owner's card never renders stale-blue. Never
   * shown; the resolver reads it and drops it. */
  freshUntil?: number;
}

export interface PublicResolutionProps {
  // The resolved card, or null for the uniform gray-nothing (no key /
  // nonexistent), which renders identically either way.
  resolved: ResolvedView | null;
  // The opaque id of the alias being resolved (doc 19): seeds the fallback face on
  // an unlinkable id rather than the handle when the card carries no avatar.
  aliasId?: string | undefined;
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
  // contact instead of knocking. onAccept resolves with the return link to share,
  // carrying the accepter's own reveal choice (anonymous by default, doc 15).
  canAccept?: boolean;
  onAccept?:
    | ((label: string, reveal: AcceptReveal) => Promise<string>)
    | undefined;
  // The accepter's own name + face for the reveal choice (doc 15): whether they have
  // a name to show and the fallback face for the per-link picker. Never the inviter's.
  accepterName?: string | undefined;
  accepterAvatar?: AvatarConfig | undefined;
  // A logged-in viewer opening a RETURN link completes the two-way link in one tap
  // (no paste). onConnect ingests the return and finishes their side.
  canConnect?: boolean;
  onConnect?: (() => void) | undefined;
  onBack?: () => void;
  onClaim?: () => void;
  onVerify?: () => void;
  onKnock?: () => void;
  // Present only when the viewer arrived via a public findable name (doc 17): a
  // quiet affordance to report that name. Absent for keyed / sample links.
  onReport?: (() => void) | undefined;
}

export function PublicResolution({
  resolved,
  aliasId,
  self = false,
  picker,
  linkHolder = false,
  initialKnockSent = false,
  canAccept = false,
  onAccept,
  accepterName,
  accepterAvatar,
  canConnect = false,
  onConnect,
  onBack,
  onClaim,
  onVerify,
  onKnock,
  onReport,
}: PublicResolutionProps) {
  const [knockSent, setKnockSent] = useState(initialKnockSent);
  const doKnock = () => {
    onKnock?.();
    setKnockSent(true);
  };

  return (
    <div className="pres">
      <BackBar onBack={onBack} />

      {self && <SelfBanner />}
      {self && picker}

      <ResolvedBadge resolved={resolved} aliasId={aliasId} />

      {resolved && <SharedSummary />}

      {resolved && <Explainer />}

      <ResolutionActions
        self={self}
        resolved={resolved}
        linkHolder={linkHolder}
        knockSent={knockSent}
        canAccept={canAccept}
        onAccept={onAccept}
        accepterName={accepterName}
        accepterAvatar={accepterAvatar}
        canConnect={canConnect}
        onConnect={onConnect}
        onKnock={doKnock}
        onBack={onBack}
        onClaim={onClaim}
        onVerify={onVerify}
      />

      {onReport && <ReportNameLink onReport={onReport} />}
    </div>
  );
}

// A quiet "report this name" affordance, shown only when the viewer reached this
// card through a public findable name. Understated on purpose: it sits below the
// primary actions and never competes with them.
function ReportNameLink({ onReport }: { onReport: () => void }) {
  return (
    <button type="button" onClick={onReport} className="pres__report-name">
      Report this name
    </button>
  );
}
