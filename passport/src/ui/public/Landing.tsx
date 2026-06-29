import type { ReactNode } from "react";
import { Card, Button } from "../../design/components/index.ts";
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

// A1 logged-out landing. Faithful port of public.jsx Landing, copy verbatim
// from copy.js (landing). Behavioral framing only, no verdict language.
const COPY = {
  eyebrow: "The pocket STI passport",
  title: "Know where you stand.",
  sub: "Share a link or scan in person to see where someone stands. Just the status, never the details.",
  claim: "Claim your passport",
  sample: "See a sample card",
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
    <div style={{ display: "flex", gap: 13 }}>
      <span
        style={{
          flex: "none",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <div>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function LandingHeader({ onLogin }: { onLogin?: (() => void) | undefined }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 2,
      }}
    >
      <img
        src="/assets/logo/logo-wordmark.svg"
        alt="sti.care"
        style={{ height: 28 }}
      />
      <Button variant="ghost" size="sm" onClick={onLogin}>
        Log in
      </Button>
    </div>
  );
}

function LandingHero() {
  return (
    <div style={{ marginTop: 2 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-accent)",
          marginBottom: 10,
        }}
      >
        {COPY.eyebrow}
      </div>
      <h1
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          color: "var(--text-strong)",
          textWrap: "balance",
        }}
      >
        {COPY.title}
      </h1>
      <p
        style={{
          fontSize: 15.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
          marginTop: 12,
        }}
      >
        {COPY.sub}
      </p>
    </div>
  );
}

function SampleCard() {
  return (
    <div style={{ position: "relative" }}>
      <BadgeCard
        state="blue"
        labels={["hiv", "condoms_always"]}
        identity={{ handle: "sam" }}
        width="100%"
      />
      <span
        style={{
          position: "absolute",
          top: -9,
          left: 14,
          background: "var(--ink-900)",
          color: "#fff",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "3px 9px",
          borderRadius: "var(--radius-pill)",
        }}
      >
        Sample
      </span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {COPY.points.map((p, i) => (
        <ValuePoint key={p[0]} icon={icons[i]} title={p[0]} body={p[1]} />
      ))}
    </Card>
  );
}

function PromisesLink({
  onPromises,
}: {
  onPromises?: (() => void) | undefined;
}) {
  if (!onPromises) return null;
  return (
    <button
      type="button"
      onClick={onPromises}
      style={{
        alignSelf: "center",
        marginTop: -8,
        padding: 0,
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text-accent)",
      }}
    >
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
    <button
      type="button"
      onClick={onRequests}
      style={{
        appearance: "none",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--divider)",
        background: "var(--accent-soft)",
        color: "var(--text-accent)",
      }}
    >
      <Eye size={17} style={{ flex: "none" }} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{label}</span>
      <ArrowRight size={17} style={{ flex: "none" }} />
    </button>
  );
}

function PrivacyFootnote() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        color: "var(--text-subtle)",
        fontSize: 12.5,
      }}
    >
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
}: LandingProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        paddingBottom: 8,
        width: "100%",
        maxWidth: 600,
      }}
    >
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
      />
    </div>
  );
}
