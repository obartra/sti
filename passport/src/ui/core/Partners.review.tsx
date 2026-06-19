import { Button, Card } from "../../design/components/index.ts";
import {
  Lock,
  Bell,
  Heart,
  Circles,
  Info,
  Eye,
  ShieldCheck,
  Clock,
} from "../../design/icons.tsx";
import { COPY, fieldLbl, Step } from "./Partners.parts.tsx";

export function IntroCards() {
  return (
    <>
      <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Step icon={<Lock size={18} />} title={COPY.steps[0][0]}>
          {COPY.steps[0][1]}
        </Step>
        <Step icon={<Bell size={18} />} title={COPY.steps[1][0]}>
          {COPY.steps[1][1]}
        </Step>
        <Step icon={<Heart size={18} />} title={COPY.steps[2][0]}>
          {COPY.steps[2][1]}
        </Step>
      </Card>
      {/* Folded in from the removed circle-transparency screen: circles ride the
          same contentless anonymous pipeline, one plain line, no scope view, no
          count. */}
      <Card
        variant="flat"
        style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
      >
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
            marginTop: 1,
          }}
        >
          <Circles size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {COPY.circlesTitle}
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--text-body)",
              marginTop: 2,
            }}
          >
            {COPY.circlesBody}
          </div>
        </div>
      </Card>
    </>
  );
}

export function MessagePreview({
  onPreviewAlert,
}: {
  onPreviewAlert?: (() => void) | undefined;
}) {
  return (
    <div>
      <div style={fieldLbl}>{COPY.messageTitle}</div>
      <Card
        variant="flat"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--surface-sunken)",
          boxShadow: "none",
          border: "none",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <span
            style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
          >
            <Bell size={18} />
          </span>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--text-body)",
            }}
          >
            “{COPY.messageBody}”
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye size={15} />}
          onClick={onPreviewAlert}
          style={{ alignSelf: "flex-start" }}
        >
          {COPY.previewAlert}
        </Button>
      </Card>
    </div>
  );
}

export function AnonCheck({ safe }: { safe: boolean }) {
  return (
    <Card
      variant="flat"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        borderColor: safe ? "var(--status-clear-base)" : "var(--border-card)",
      }}
    >
      <span
        style={{
          color: safe ? "var(--status-clear-base)" : "var(--text-accent)",
          flex: "none",
          marginTop: 1,
        }}
      >
        {safe ? <ShieldCheck size={20} /> : <Info size={20} />}
      </span>
      <div>
        <div
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.anonTitle}
        </div>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "var(--text-body)",
            marginTop: 2,
          }}
        >
          {safe ? COPY.anonOk : COPY.anonSingle}
        </div>
      </div>
    </Card>
  );
}

export function BatchCard() {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
    >
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Clock size={20} />
      </span>
      <div>
        <div
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.batchTitle}
        </div>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "var(--text-body)",
            marginTop: 2,
          }}
        >
          {COPY.batchNote}
        </div>
      </div>
    </Card>
  );
}
