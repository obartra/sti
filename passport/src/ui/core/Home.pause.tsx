import { Button, Card } from "../../design/components/index.ts";
import { EyeOff, Lock, Clock, Eye } from "../../design/icons.tsx";
import { COPY, leadTile, fmtDate } from "./Home.parts.tsx";

// Owner-only pause panel. A viewer NEVER sees this or anything but gray;
// pausing renders identically to every other gray. Manual hide is liftable
// anytime; auto-pause (from a logged positive's clearance window) can be
// EXTENDED but not shortened below the guideline window.
function AutoResumePanel({ untilLabel }: { untilLabel: string }) {
  const p = COPY.pause;
  return (
    <div
      style={{
        background: "var(--surface-sunken)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--text-muted)",
          }}
        >
          {p.autoUntil}
        </span>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-strong)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {untilLabel}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          lineHeight: 1.45,
        }}
      >
        {p.autoNote}
      </div>
    </div>
  );
}

export function PauseBanner({
  autoPaused,
  clearBy,
  resume,
  onExtend,
}: {
  autoPaused: boolean;
  clearBy: Date;
  resume: (() => void) | undefined;
  onExtend: (() => void) | undefined;
}) {
  const p = COPY.pause;
  // The clearance date comes from owner state; extending persists it (clearBy
  // advances on the next render) rather than living in local component state.
  const untilLabel = fmtDate(clearBy);
  return (
    <Card
      variant="flat"
      style={{
        borderColor: "var(--border-strong)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <span
          style={{
            ...leadTile,
            background: "var(--surface-sunken)",
            color: "var(--text-muted)",
          }}
        >
          <EyeOff size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {autoPaused ? p.autoTitle : p.manualOn}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              marginTop: 2,
            }}
          >
            {autoPaused ? p.autoSub : p.manualOnSub}
          </div>
        </div>
      </div>
      {autoPaused && <AutoResumePanel untilLabel={untilLabel} />}
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Lock size={13} /> {p.ownerOnly}
      </div>
      {autoPaused ? (
        <Button
          variant="secondary"
          size="md"
          block
          icon={<Clock size={16} />}
          onClick={onExtend}
        >
          {p.extend}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="md"
          block
          icon={<Eye size={16} />}
          onClick={resume}
        >
          {p.resume}
        </Button>
      )}
    </Card>
  );
}
