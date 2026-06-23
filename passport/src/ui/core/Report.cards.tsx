import { Card } from "../../design/components/index.ts";
import { Info, Heart, EyeOff, ShieldCheck } from "../../design/icons.tsx";
import { COPY } from "./Report.parts.tsx";

export function CorePanelCard({
  touchedAny,
  coreComplete,
  coreMissing,
}: {
  touchedAny: boolean;
  coreComplete: boolean;
  coreMissing: string[];
}) {
  const c = COPY;
  const done = touchedAny && coreComplete;
  return (
    <Card
      variant={done ? "tint" : "flat"}
      style={{
        display: "flex",
        gap: 12,
        borderColor: done ? "var(--status-clear-base)" : "var(--border-card)",
      }}
    >
      <span
        style={{
          flex: "none",
          marginTop: 1,
          color: done ? "var(--status-clear-base)" : "var(--text-accent)",
        }}
      >
        {done ? <ShieldCheck size={19} /> : <Info size={19} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {c.coreTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text-body)",
            marginTop: 2,
          }}
        >
          {!touchedAny
            ? c.coreBody
            : coreComplete
              ? c.coreCovered
              : c.coreIncomplete}
        </div>
        {touchedAny && !coreComplete && coreMissing.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-subtle)",
              marginTop: 7,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontSize: 10.5,
              }}
            >
              {c.coreMissingLabel}
            </span>
            {coreMissing.map((m) => (
              <span
                key={m}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "var(--surface-sunken)",
                  color: "var(--text-muted)",
                  borderRadius: "var(--radius-pill)",
                  padding: "2px 9px",
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ChronicCard({ herpesPositive }: { herpesPositive: boolean }) {
  const c = COPY;
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", gap: 12 }}>
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
          <Heart size={19} />
        </span>
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {c.chronicTitle}
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--text-body)",
              marginTop: 2,
            }}
          >
            {c.chronicBody}
          </div>
        </div>
      </div>
      {herpesPositive && (
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--text-muted)",
            display: "flex",
            gap: 7,
            alignItems: "flex-start",
            borderTop: "1px solid var(--divider)",
            paddingTop: 10,
          }}
        >
          <span
            style={{
              flex: "none",
              marginTop: 1,
              color: "var(--text-accent)",
            }}
          >
            <EyeOff size={14} />
          </span>
          {c.chronicOutbreak}
        </div>
      )}
    </Card>
  );
}
