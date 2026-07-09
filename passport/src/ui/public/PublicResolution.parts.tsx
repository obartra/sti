import { Button } from "../../design/components/index.ts";
import {
  Back,
  Lock,
  Eye,
  Check,
  Link as LinkIcon,
  ShieldPlus,
} from "../../design/icons.tsx";
import { BadgeCard } from "../badge-card.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import { COPY, KNOCK_UNIFORM } from "./PublicResolution.copy.ts";
import {
  AcceptInviteSection,
  ConnectSection,
  type AcceptReveal,
} from "./PublicResolution.accept.tsx";
import type { AvatarConfig } from "../../lib/avatars.ts";
import "./public.css";
import "./public-resolution.css";

export function BackBar({ onBack }: { onBack?: (() => void) | undefined }) {
  return (
    <div className="pub-headrow">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="pub-back"
      >
        <Back size={20} />
      </button>
    </div>
  );
}

export function ResolvedBadge({
  resolved,
  aliasId,
}: {
  resolved: ResolvedView | null;
  // The opaque id of the alias this card resolves (doc 19): when the card carries
  // no chosen avatar, the fallback face seeds on it, not the (possibly user-chosen)
  // handle the payload supplied.
  aliasId?: string | undefined;
}) {
  return (
    <BadgeCard
      state={resolved ? resolved.state : "gray"}
      labels={resolved?.labels ?? []}
      route={resolved?.route ?? null}
      identity={
        resolved
          ? { ...resolved.identity, ...(aliasId ? { id: aliasId } : {}) }
          : null
      }
      avatarSrc={resolved?.avatarSrc}
      width="100%"
    />
  );
}

export function SelfBanner() {
  return (
    <div className="pres__note">
      <span className="pres__note-icon">
        <Eye size={17} />
      </span>
      <span>{COPY.selfBanner}</span>
    </div>
  );
}

export function SharedSummary() {
  return (
    <div className="pres__note">
      <span className="pres__note-icon">
        <Eye size={18} />
      </span>
      <div>
        This is everything shared: a <strong>status</strong>, plus any
        protection details they choose to add. Just that.
      </div>
    </div>
  );
}

function KnockPrompt({ onKnock }: { onKnock: () => void }) {
  return (
    <div className="e-card pres__knock">
      <div className="pres__knock-head">
        <span className="pres__knock-icon">
          <LinkIcon size={18} />
        </span>
        <span className="pres__knock-title">{COPY.knockTitle}</span>
      </div>
      <p className="pres__knock-body">{COPY.knockBody}</p>
      <Button variant="primary" size="lg" block onClick={onKnock}>
        {COPY.knockCta}
      </Button>
    </div>
  );
}

function KnockSent({ onBack }: { onBack?: (() => void) | undefined }) {
  return (
    <div className="pres__sent">
      <span className="pres__sent-mark">
        <Check size={27} />
      </span>
      <div className="pres__sent-title">{KNOCK_UNIFORM}</div>
      <p className="pres__sent-body">{COPY.knockSentBody}</p>
      <Button variant="secondary" size="md" onClick={onBack}>
        {COPY.knockDone}
      </Button>
    </div>
  );
}

function KnockFootnote() {
  return (
    <div className="pres__footnote">
      <Lock size={13} className="pres__footnote-icon" /> {COPY.knockFootnote}
    </div>
  );
}

function KnockSection({
  linkHolder,
  knockSent,
  onKnock,
  onBack,
}: {
  linkHolder: boolean;
  knockSent: boolean;
  onKnock: () => void;
  onBack?: (() => void) | undefined;
}) {
  if (!linkHolder) return null;
  return (
    <>
      {!knockSent && <KnockPrompt onKnock={onKnock} />}
      {knockSent && <KnockSent onBack={onBack} />}
      <KnockFootnote />
    </>
  );
}

function ColdActions({
  onClaim,
  onVerify,
}: {
  onClaim?: (() => void) | undefined;
  onVerify?: (() => void) | undefined;
}) {
  return (
    <div className="pres__cold">
      <Button
        variant="primary"
        size="lg"
        block
        icon={<ShieldPlus size={18} />}
        onClick={onClaim}
      >
        {COPY.soft}
      </Button>
      <Button variant="ghost" size="md" block onClick={onVerify}>
        {COPY.verify}
      </Button>
    </div>
  );
}

// The action region below the card: a logged-in viewer opening a return link
// completes the two-way link (connect); one opening a fresh invite adds the
// inviter (accept, path A); otherwise the link-holder knock prompt plus, for a
// resolved stranger card, the claim/verify CTAs. Gray-nothing stays button-free.
export function ResolutionActions({
  self,
  resolved,
  linkHolder,
  knockSent,
  canAccept,
  onAccept,
  accepterName,
  accepterAvatar,
  canConnect,
  onConnect,
  onKnock,
  onBack,
  onClaim,
  onVerify,
}: {
  self: boolean;
  resolved: ResolvedView | null;
  linkHolder: boolean;
  knockSent: boolean;
  canAccept: boolean;
  onAccept?:
    ((label: string, reveal: AcceptReveal) => Promise<string>) | undefined;
  // The accepter's own name + face (doc 15): whether they have a name to reveal and
  // the fallback face for the per-link picker. Never the inviter's.
  accepterName?: string | undefined;
  accepterAvatar?: AvatarConfig | undefined;
  canConnect: boolean;
  onConnect?: (() => void) | undefined;
  onKnock: () => void;
  onBack?: (() => void) | undefined;
  onClaim?: (() => void) | undefined;
  onVerify?: (() => void) | undefined;
}) {
  if (resolved && canConnect && onConnect) {
    return (
      <ConnectSection handle={resolved.identity.handle} onConnect={onConnect} />
    );
  }
  if (resolved && canAccept && onAccept) {
    return (
      <AcceptInviteSection
        handle={resolved.identity.handle}
        accepterName={accepterName}
        accepterAvatar={accepterAvatar}
        onAccept={onAccept}
      />
    );
  }
  return (
    <>
      <KnockSection
        linkHolder={linkHolder}
        knockSent={knockSent}
        onKnock={onKnock}
        onBack={onBack}
      />
      {!self && resolved && (
        <ColdActions onClaim={onClaim} onVerify={onVerify} />
      )}
    </>
  );
}
