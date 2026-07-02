import type { ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import {
  Link as LinkIcon,
  Lock,
  Bell,
  ArrowRight,
  Eye,
} from "../../design/icons.tsx";
import { TrustFooter } from "../trust/TrustFooter.tsx";
import { LANDING_PROMISES_LINK } from "../trust/trustCopy.ts";
import "./landing.css";

// A1 logged-out landing on the editorial grammar (doc 37): serif claim, the
// sample card as the hero object, one filled action, hairline value points.
// Copy verbatim; behavioral framing only, no verdict language.
const COPY = {
  eyebrow: "The pocket STI passport",
  title: "Know where you stand.",
  sub: "Share a link or scan in person to see where someone stands. Just the status, never the details.",
  claim: "Claim your passport",
  sample: "Try the demo",
  points: [
    [
      "Know before you meet",
      "Open the link they share, or scan in person, and see if they’re up to date before you connect.",
    ],
    [
      "Share without oversharing",
      "Your card shows one simple status. It never shows what you tested for.",
    ],
    [
      "Hear when it matters",
      "If a recent partner tests positive, you get an anonymous alert to go get tested.",
    ],
  ],
} as const;

function ValuePoint({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="land__point">
      <span className="land__point-icon">{icon}</span>
      <div>
        <div className="land__point-title">{title}</div>
        <div className="land__point-body">{body}</div>
      </div>
    </div>
  );
}

function LandingHeader({ onLogin }: { onLogin?: (() => void) | undefined }) {
  return (
    <div className="land__header">
      <img
        src="/assets/logo/logo-wordmark.svg"
        alt="sti.care"
        className="land__brand"
      />
      <Button variant="ghost" size="sm" onClick={onLogin}>
        Log in
      </Button>
    </div>
  );
}

function LandingHero() {
  return (
    <div className="land__hero">
      <div className="e-eyebrow land__eyebrow">{COPY.eyebrow}</div>
      <h1 className="land__title">{COPY.title}</h1>
      <p className="land__sub">{COPY.sub}</p>
    </div>
  );
}

function SampleCard() {
  return (
    <div className="land__sample">
      <BadgeCard
        state="blue"
        labels={["hiv", "condoms_always"]}
        identity={{ handle: "sam" }}
        width="100%"
      />
      <span className="land__sample-tag">Sample</span>
    </div>
  );
}

function LandingActions({
  onClaim,
  onSample,
}: {
  onClaim?: (() => void) | undefined;
  onSample?: (() => void) | undefined;
}) {
  return (
    <div className="land__actions">
      <Button variant="primary" size="lg" block onClick={onClaim}>
        {COPY.claim} <ArrowRight size={18} />
      </Button>
      <Button variant="secondary" size="lg" block onClick={onSample}>
        {COPY.sample}
      </Button>
    </div>
  );
}

function ValuePoints() {
  const icons = [
    <LinkIcon key="link" size={20} />,
    <Lock key="lock" size={20} />,
    <Bell key="bell" size={20} />,
  ];
  return (
    <div className="land__points">
      {COPY.points.map((p, i) => (
        <ValuePoint key={p[0]} icon={icons[i]} title={p[0]} body={p[1]} />
      ))}
    </div>
  );
}

function PromisesLink({
  onPromises,
}: {
  onPromises?: (() => void) | undefined;
}) {
  if (!onPromises) return null;
  return (
    <button type="button" onClick={onPromises} className="land__promises">
      {LANDING_PROMISES_LINK}
    </button>
  );
}

// A quiet way back for a viewer who asked to see someone and came back later: it
// appears only when this device has pending requests, and leads to the list where
// a now-shared status resolves. Logged-out and account-free by design.
function RequestsBanner({
  pendingCount,
  onRequests,
}: {
  pendingCount?: number | undefined;
  onRequests?: (() => void) | undefined;
}) {
  if (!pendingCount || !onRequests) return null;
  const label =
    pendingCount === 1
      ? "1 link you asked to see"
      : `${pendingCount} links you asked to see`;
  return (
    <button type="button" onClick={onRequests} className="land__requests">
      <Eye size={17} className="land__requests-icon" />
      <span className="land__requests-label">{label}</span>
      <ArrowRight size={17} className="land__requests-icon" />
    </button>
  );
}

function PrivacyFootnote() {
  return (
    <div className="land__footnote">
      <Lock size={13} /> Privacy-first · never names a condition · never a
      verdict
    </div>
  );
}

export interface LandingProps {
  onClaim?: () => void;
  onSample?: () => void;
  onLogin?: () => void;
  onPromises?: () => void;
  onPrivacyPolicy?: () => void;
  onTerms?: () => void;
  /** Count of access requests this device has made; shows the way-back banner when
   * above zero. */
  pendingCount?: number;
  /** Open the list of requests this viewer has made. */
  onRequests?: () => void;
  onShareLink?: () => void;
  /** Open the "Something wrong?" report form (doc 35). */
  onFeedback?: () => void;
}

export function Landing({
  onClaim,
  onSample,
  onLogin,
  onPromises,
  onPrivacyPolicy,
  onTerms,
  pendingCount,
  onRequests,
  onShareLink,
  onFeedback,
}: LandingProps) {
  return (
    <div className="land">
      <LandingHeader onLogin={onLogin} />
      <RequestsBanner pendingCount={pendingCount} onRequests={onRequests} />
      <LandingHero />
      <SampleCard />
      <LandingActions onClaim={onClaim} onSample={onSample} />
      <PromisesLink onPromises={onPromises} />
      <ValuePoints />
      <PrivacyFootnote />
      <TrustFooter
        onPromises={onPromises}
        onPrivacy={onPrivacyPolicy}
        onTerms={onTerms}
        onShareLink={onShareLink}
        onFeedback={onFeedback}
      />
    </div>
  );
}
