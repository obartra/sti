import { useState } from "react";
import { Card, Button, Segmented } from "../../design/components/index.ts";
import {
  Hand,
  Calendar,
  Info,
  Lock,
  Users,
  ArrowRight,
} from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";

// B3 first-run setup. Faithful port of onboarding.jsx Setup, copy verbatim from
// copy.js (setup). Sharing defaults to private ("Request only"); "Everyone" is
// a deliberate opt-in carrying the watchable-over-time warning.
const COPY = {
  title: "How your passport works",
  sub: "Two quick defaults. You can change either later in settings.",
  selfTitle: "You add your own results",
  selfBody:
    "You add results yourself, no clinic logins, no waiting. What you share is your own honest word: as you report it, not a medical test.",
  freshTitle: "Freshness window",
  freshBody: "Your status stays current for 90 days, then asks for a re-test.",
  privTitle: "Who can see your test status",
  privPublic: "Everyone",
  privPublicSub:
    "A deliberate opt-in: anyone who opens your profile sees your status, and can watch it change over time. Most people leave this off.",
  privLink: "Request only",
  privLinkSub:
    "Default. Your status stays hidden unless you share a private link. Anyone without one sees nothing at all, not even that you exist. Private links always work.",
  privDefaultNote:
    "Sharing starts private. Turning on “Everyone” is a choice, not the default.",
  anonTitle: "A heads-up that looks out for you",
  anonBody:
    "If someone you’ve linked with reports a positive, you get a private heads-up. It works both ways, always anonymous, and never names a condition.",
  cta: "Enter my passport",
} as const;

// You-add-your-own-results intro card.
function SelfCard() {
  return (
    <Card variant="tint" style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Hand size={20} />
      </span>
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.selfTitle}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text-body)",
            lineHeight: 1.55,
            marginTop: 2,
          }}
        >
          {COPY.selfBody}
        </div>
      </div>
    </Card>
  );
}

// The 90-day freshness window card.
function FreshnessCard() {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.freshTitle}
        </div>
        <span
          style={{
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--accent-soft)",
            color: "var(--text-accent)",
            borderRadius: "var(--radius-pill)",
            padding: "5px 12px",
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          <Calendar size={14} /> 90 days
        </span>
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: "var(--text-muted)",
          lineHeight: 1.55,
        }}
      >
        {COPY.freshBody}
      </div>
    </Card>
  );
}

// Who-can-see-your-status card with the private-default segmented control.
function PrivacyCard({
  sharing,
  onChange,
}: {
  sharing: "public" | "link";
  onChange: (next: "public" | "link") => void;
}) {
  const isPublic = sharing === "public";
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
      >
        {COPY.privTitle}
      </div>
      <Segmented
        aria-label={COPY.privTitle}
        value={sharing}
        onChange={onChange}
        options={[
          { value: "public", label: COPY.privPublic },
          { value: "link", label: COPY.privLink },
        ]}
      />
      <div
        style={{
          fontSize: 13,
          color: isPublic ? "var(--status-treat-fg)" : "var(--text-muted)",
          lineHeight: 1.5,
          display: "flex",
          gap: 6,
        }}
      >
        {isPublic && (
          <span style={{ flex: "none", marginTop: 1 }}>
            <Info size={14} />
          </span>
        )}
        <span>{isPublic ? COPY.privPublicSub : COPY.privLinkSub}</span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Lock size={12} /> {COPY.privDefaultNote}
      </div>
    </Card>
  );
}

// Anonymous heads-up explainer card.
function AnonCard() {
  return (
    <Card variant="flat" style={{ display: "flex", gap: 14 }}>
      <span
        style={{
          flex: "none",
          width: 40,
          height: 40,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Users size={20} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {COPY.anonTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 3,
          }}
        >
          {COPY.anonBody}
        </div>
      </div>
    </Card>
  );
}

export interface FirstRunSetupProps {
  onBack?: () => void;
  /** Enter the app with the chosen account-level sharing default. */
  onEnter?: (sharingMode: "public" | "link") => void;
  /** Finishing setup is in flight (account write + passkey enroll). */
  busy?: boolean;
  /** A user-facing error if finishing setup failed. */
  error?: string | null;
}

export function FirstRunSetup({
  onBack,
  onEnter,
  busy = false,
  error = null,
}: FirstRunSetupProps) {
  // Private by default; "Everyone" is the opt-in.
  const [sharing, setSharing] = useState<"public" | "link">("link");
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
      <TopBack title="Step 3 of 3" onBack={onBack} />
      <div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.title}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-body)", marginTop: 6 }}>
          {COPY.sub}
        </p>
      </div>

      <SelfCard />
      <FreshnessCard />
      <PrivacyCard sharing={sharing} onChange={setSharing} />
      <AnonCard />

      {error !== null && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--status-expired-fg)",
          }}
        >
          {error}
        </div>
      )}
      <Button
        variant="primary"
        size="lg"
        block
        disabled={busy}
        onClick={() => onEnter?.(sharing)}
      >
        {COPY.cta} <ArrowRight size={18} />
      </Button>
    </div>
  );
}
