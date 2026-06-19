import { Button, Card } from "../../design/components/index.ts";
import { Lock, ShieldCheck } from "../../design/icons.tsx";
import { COPY } from "./Partners.parts.tsx";

// LOCKED: deliberately shows NOTHING about timing, delivery, recipients.
export function LockedView({
  onContinue,
}: {
  onContinue?: (() => void) | undefined;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 18,
        paddingTop: 36,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <span
        style={{
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: "var(--surface-sunken)",
          color: "var(--text-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock size={34} />
      </span>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {COPY.lockedTitle}
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--text-body)",
          margin: 0,
          maxWidth: 320,
        }}
      >
        {COPY.lockedBody}
      </p>
      <Card
        variant="tint"
        style={{ display: "flex", gap: 12, textAlign: "left" }}
      >
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <ShieldCheck size={18} />
        </span>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-body)",
          }}
        >
          {COPY.lockedReassure}
        </div>
      </Card>
      <Button variant="primary" size="lg" block onClick={onContinue}>
        {COPY.lockedCta}
      </Button>
    </div>
  );
}
