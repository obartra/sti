import { Card } from "../../design/components/index.ts";
import { ArrowRight, Stethoscope } from "../../design/icons.tsx";
import { COPY } from "./conditions.ts";
import type { Condition } from "./conditions.ts";
import { B, LabelChip } from "./shared.tsx";

const c = COPY;

// Title, label chip, and intro paragraph for a condition.
export function DetailHeader({ cond }: { cond: Condition }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1
          style={{
            fontSize: 27,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {cond.name}
        </h1>
        <LabelChip label={cond.label} tone={cond.tone} />
      </div>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--text-body)",
          marginTop: 8,
          marginBottom: 0,
        }}
      >
        {cond.intro}
      </p>
    </div>
  );
}

// The question-and-answer cards for a condition.
export function QaList({ cond }: { cond: Condition }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {cond.qa.map((row, i) => (
        <Card
          key={i}
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {row[0]}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text-body)",
            }}
          >
            <B text={row[1]} />
          </div>
        </Card>
      ))}
    </div>
  );
}

// How-to-test callout.
export function TestCard({ test }: { test: string }) {
  return (
    <Card variant="tint" style={{ display: "flex", gap: 12 }}>
      <span
        style={{
          flex: "none",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-card)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stethoscope size={19} />
      </span>
      <div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {c.howToTest}
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--text-body)",
            marginTop: 2,
          }}
        >
          {test}
        </div>
      </div>
    </Card>
  );
}

// HIV-only nudge to the shareable U=U card.
export function UULink({ onOpenUU }: { onOpenUU?: (() => void) | undefined }) {
  return (
    <Card
      variant="tint"
      onClick={() => onOpenUU?.()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          background: "var(--status-clear-bg)",
          color: "var(--status-clear-fg)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        U=U
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-strong)",
        }}
      >
        {c.uu.fromHiv}
      </span>
      <ArrowRight
        size={17}
        style={{ color: "var(--text-accent)", flex: "none" }}
      />
    </Card>
  );
}
