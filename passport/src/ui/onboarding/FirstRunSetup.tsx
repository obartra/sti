import { useState } from "react";
import { FINDABLE_ENABLED } from "../../features.ts";
import { ConsentLine } from "./ConsentLine.tsx";
import { Card, Button, Segmented } from "../../design/components/index.ts";
import {
  Hand,
  Calendar,
  Link,
  Globe,
  Lock,
  Users,
  ArrowRight,
} from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";

// B3 first-run setup. Sets the freshness intro and the account's default reach
// mode (doc 16): how the links you share let people reach your status. Direct
// (hand someone a keyed link, instant) is the default; Gated (post a link, you
// approve each knock) is the privacy-forward alternative; Findable (a memorable
// name) is the third mode, not built yet, shown disabled so the roadmap is honest.
const COPY = {
  title: "How your passport works",
  sub: "Two quick defaults. You can change either later in settings.",
  selfTitle: "You add your own results",
  selfBody:
    "You add results yourself, no clinic logins, no waiting. What you share is your own honest word: as you report it, not a medical test.",
  freshTitle: "Freshness window",
  freshBody: "Your status stays current for 90 days, then asks for a re-test.",
  reachTitle: "How people reach your status",
  reachDirect: "Direct link",
  reachDirectSub:
    "Default. You hand someone a link (a DM, a scan, a link made for one person) and it opens to your status right away. Handing it over is the trust step.",
  reachGated: "Ask first",
  reachGatedSub:
    "Post a link anywhere. Opening it only lets someone ask; you approve each person yourself before they see anything.",
  reachFindable: "Findable",
  reachFindableSoon: "Soon",
  reachFindableSub:
    "A memorable name people can find and put in a bio. It needs a public name to work, so it’s coming later.",
  reachFindableReadySub:
    "A memorable name people can find and put in a bio. Claim one anytime from Settings.",
  reachNote:
    "Either way, your status stays off the open web: no name to look up, and someone without a link can’t even tell you exist.",
  anonTitle: "A heads-up that looks out for you",
  anonBody:
    "If someone you’ve linked with reports a positive, you get a private heads-up. Always anonymous, and never names a condition.",
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

// The Findable mode (vanity name + request, doc 16/17). Informational, not a
// selectable sharing mode: a name is claimed separately from Settings, so this row
// just points there. Until the feature ships (FINDABLE_ENABLED) it reads disabled
// with a "Soon" badge so the roadmap stays honest.
function FindableRow() {
  const ready = FINDABLE_ENABLED;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        opacity: ready ? 1 : 0.55,
        borderTop: "1px solid var(--border-card)",
        paddingTop: 12,
      }}
    >
      <span
        style={{
          flex: "none",
          marginTop: 1,
          color: ready ? "var(--text-accent)" : "var(--text-subtle)",
        }}
      >
        <Globe size={14} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-strong)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {COPY.reachFindable}
          {!ready && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-subtle)",
                background: "var(--surface-sunken)",
                borderRadius: "var(--radius-pill)",
                padding: "2px 8px",
              }}
            >
              {COPY.reachFindableSoon}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {ready ? COPY.reachFindableReadySub : COPY.reachFindableSub}
        </div>
      </div>
    </div>
  );
}

// How-people-reach-your-status card: Direct (default) vs Gated, plus the
// disabled Findable row. Maps to the account sharing mode: Direct = "public"
// (the key rides the link, instant), Gated = "link" (no key, each viewer knocks).
function ReachCard({
  sharing,
  onChange,
}: {
  sharing: "public" | "link";
  onChange: (next: "public" | "link") => void;
}) {
  const direct = sharing === "public";
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
      >
        {COPY.reachTitle}
      </div>
      <Segmented
        aria-label={COPY.reachTitle}
        value={sharing}
        onChange={onChange}
        options={[
          { value: "public", label: COPY.reachDirect },
          { value: "link", label: COPY.reachGated },
        ]}
      />
      <div
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.5,
          display: "flex",
          gap: 6,
        }}
      >
        <span
          style={{ flex: "none", marginTop: 1, color: "var(--text-accent)" }}
        >
          {direct ? <Link size={14} /> : <Hand size={14} />}
        </span>
        <span>{direct ? COPY.reachDirectSub : COPY.reachGatedSub}</span>
      </div>
      <FindableRow />
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          lineHeight: 1.45,
        }}
      >
        <span style={{ flex: "none", marginTop: 1 }}>
          <Lock size={12} />
        </span>
        {COPY.reachNote}
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
  /** Open the privacy policy / terms from the consent line (doc 22). */
  onViewPrivacyPolicy?: () => void;
  onViewTerms?: () => void;
}

export function FirstRunSetup({
  onBack,
  onEnter,
  busy = false,
  error = null,
  onViewPrivacyPolicy,
  onViewTerms,
}: FirstRunSetupProps) {
  // Direct ("public") is the default reach mode (doc 16): a link you hand over
  // opens instantly. "Ask first" (Gated, "link") is the approve-each-viewer mode.
  const [sharing, setSharing] = useState<"public" | "link">("public");
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
      <ReachCard sharing={sharing} onChange={setSharing} />
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
      <ConsentLine
        onViewPrivacyPolicy={onViewPrivacyPolicy}
        onViewTerms={onViewTerms}
      />
    </div>
  );
}
