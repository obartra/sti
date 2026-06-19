import { Button, Card } from "../../design/components/index.ts";
import {
  Chevron,
  Clock,
  MapPin,
  Shield,
  Stethoscope,
} from "../../design/icons.tsx";
import { COPY } from "./conditions.ts";
import { LabelChip } from "./shared.tsx";

const c = COPY;

// The tappable list of condition explainers.
export function ConditionList({
  onOpenDetail,
}: {
  onOpenDetail?: ((id: string) => void) | undefined;
}) {
  return (
    <Card
      variant="flat"
      style={{ padding: 6, display: "flex", flexDirection: "column" }}
    >
      {c.conditions.map((cond) => (
        <button
          key={cond.id}
          type="button"
          onClick={() => onOpenDetail?.(cond.id)}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 10px",
            font: "inherit",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 15.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {cond.name}
          </span>
          <LabelChip label={cond.label} tone={cond.tone} />
          <Chevron
            size={17}
            style={{ color: "var(--text-subtle)", flex: "none" }}
          />
        </button>
      ))}
    </Card>
  );
}

// U=U, education, deliberately separate from anyone's status.
export function UUCard({ onOpenUU }: { onOpenUU?: (() => void) | undefined }) {
  return (
    <Card
      variant="tint"
      onClick={() => onOpenUU?.()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 44,
          height: 44,
          borderRadius: "var(--radius-sm)",
          background: "var(--status-clear-bg)",
          color: "var(--status-clear-fg)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        U=U
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {c.uu.title}
        </div>
        <div
          style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}
        >
          A made-to-share card. Good news, no stigma.
        </div>
      </div>
      <Chevron
        size={17}
        style={{ color: "var(--text-subtle)", flex: "none" }}
      />
    </Card>
  );
}

// Always-on PEP education, independent of any exposure alert.
export function PepCard({
  onFindPep,
}: {
  onFindPep?: (() => void) | undefined;
}) {
  return (
    <Card
      variant="flat"
      style={{
        borderColor: "var(--status-treat-base)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              flex: "none",
              width: 38,
              height: 38,
              borderRadius: "var(--radius-sm)",
              background: "var(--status-treat-bg)",
              color: "var(--status-treat-base)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={19} />
          </span>
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {c.pepLibTitle}
          </span>
        </div>
        <span
          style={{
            flex: "none",
            background: "var(--status-treat-bg)",
            color: "var(--status-treat-fg)",
            borderRadius: "var(--radius-pill)",
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {c.pepLibChip}
        </span>
      </div>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
        }}
      >
        {c.pepLibBody}
      </div>
      <Button
        variant="secondary"
        size="md"
        block
        icon={<MapPin size={16} />}
        onClick={() => onFindPep?.()}
      >
        {c.pepLibCta}
      </Button>
    </Card>
  );
}

// Ways to lower HIV risk, tools explained, never ranked.
export function ToolsCard() {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {c.toolsTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {c.toolsBody}
        </div>
      </div>
      {c.toolsItems.map((row, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <span
            style={{
              flex: "none",
              marginTop: 1,
              color: "var(--text-accent)",
            }}
          >
            <Shield size={16} />
          </span>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--text-body)",
            }}
          >
            <strong style={{ color: "var(--text-strong)" }}>{row[0]}</strong>,{" "}
            {row[1]}
          </div>
        </div>
      ))}
    </Card>
  );
}

// Vaccination + screening ramps, universal, status-free.
export function VaxCard({
  onFindClinic,
}: {
  onFindClinic?: (() => void) | undefined;
}) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {c.vaxTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {c.vaxBody}
        </div>
      </div>
      {c.vaxItems.map((row, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <span
            style={{
              flex: "none",
              marginTop: 1,
              color: "var(--text-accent)",
            }}
          >
            <Stethoscope size={16} />
          </span>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--text-body)",
            }}
          >
            <strong style={{ color: "var(--text-strong)" }}>{row[0]}</strong>,{" "}
            {row[1]}
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        size="md"
        block
        icon={<MapPin size={16} />}
        onClick={() => onFindClinic?.()}
      >
        {c.vaxCta}
      </Button>
    </Card>
  );
}
