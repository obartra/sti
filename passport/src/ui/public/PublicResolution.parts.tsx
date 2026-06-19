import { Card, Button } from "../../design/components/index.ts";
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
import { COPY, KNOCK_UNIFORM, backBtn } from "./PublicResolution.copy.ts";

export function BackBar({ onBack }: { onBack?: (() => void) | undefined }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2 }}
    >
      <button type="button" onClick={onBack} aria-label="Back" style={backBtn}>
        <Back size={20} />
      </button>
    </div>
  );
}

export function ResolvedBadge({ resolved }: { resolved: ResolvedView | null }) {
  return (
    <BadgeCard
      state={resolved ? resolved.state : "gray"}
      labels={resolved?.labels ?? []}
      route={resolved?.route ?? null}
      identity={resolved ? resolved.identity : null}
      avatarSrc={resolved?.avatarSrc}
      width="100%"
    />
  );
}

export function SelfBanner() {
  return (
    <Card
      variant="tint"
      pad="sm"
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      <span style={{ color: "var(--text-accent)", flex: "none" }}>
        <Eye size={17} />
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--text-body)",
        }}
      >
        {COPY.selfBanner}
      </span>
    </Card>
  );
}

export function SharedSummary() {
  return (
    <Card variant="tint" style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Eye size={18} />
      </span>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.5,
          color: "var(--text-body)",
        }}
      >
        This is everything shared: a{" "}
        <strong style={{ color: "var(--text-strong)" }}>status</strong>, plus
        any protection facts they choose to add. No test names, no dates.
      </div>
    </Card>
  );
}

function KnockPrompt({ onKnock }: { onKnock: () => void }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            flex: "none",
            width: 34,
            height: 34,
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-soft)",
            color: "var(--text-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinkIcon size={18} />
        </span>
        <span
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.knockTitle}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-muted)",
        }}
      >
        {COPY.knockBody}
      </p>
      <Button variant="primary" size="lg" block onClick={onKnock}>
        {COPY.knockCta}
      </Button>
    </Card>
  );
}

function KnockSent({ onBack }: { onBack?: (() => void) | undefined }) {
  return (
    <Card
      variant="tint"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        paddingTop: 22,
        paddingBottom: 22,
      }}
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          flex: "none",
          background: "var(--surface-card)",
          color: "var(--text-accent)",
          boxShadow: "var(--shadow-sm)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={27} />
      </span>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
          color: "var(--text-strong)",
          maxWidth: 280,
        }}
      >
        {KNOCK_UNIFORM}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-muted)",
          maxWidth: 290,
        }}
      >
        {COPY.knockSentBody}
      </p>
      <Button
        variant="secondary"
        size="md"
        onClick={onBack}
        style={{ marginTop: 2 }}
      >
        {COPY.knockDone}
      </Button>
    </Card>
  );
}

function KnockFootnote() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 7,
        padding: "0 4px",
        color: "var(--text-subtle)",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <Lock size={13} style={{ flex: "none", marginTop: 2 }} />{" "}
      {COPY.knockFootnote}
    </div>
  );
}

export function KnockSection({
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

export function ColdActions({
  onClaim,
  onVerify,
}: {
  onClaim?: (() => void) | undefined;
  onVerify?: (() => void) | undefined;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
