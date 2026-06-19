import { Card } from "../../design/components/index.ts";
import {
  MapPin,
  Clock,
  Shield,
  Stethoscope,
  Check,
  Lock,
} from "../../design/icons.tsx";
import { C, finderBtn, finderTile } from "./Alert.copy.ts";

export function ResourcesCard({
  onFindPep,
  onFindCondoms,
  onFindPrep,
}: {
  onFindPep?: (() => void) | undefined;
  onFindCondoms?: (() => void) | undefined;
  onFindPrep?: (() => void) | undefined;
}) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          padding: "2px 4px 6px",
        }}
      >
        {C.resourcesTitle}
      </div>
      <button type="button" onClick={onFindPep} style={finderBtn}>
        <span
          style={{
            ...finderTile,
            background: "var(--status-treat-bg)",
            color: "var(--status-treat-base)",
          }}
        >
          <Clock size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-strong)",
            }}
          >
            {C.findPepNear}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--status-treat-fg)",
              marginTop: 1,
            }}
          >
            {C.findPepNearSub}
          </span>
        </span>
        <MapPin
          size={16}
          style={{ color: "var(--text-subtle)", flex: "none" }}
        />
      </button>
      <button type="button" onClick={onFindCondoms} style={finderBtn}>
        <span style={finderTile}>
          <Shield size={18} />
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {C.findCondoms}
        </span>
        <MapPin
          size={16}
          style={{ color: "var(--text-subtle)", flex: "none" }}
        />
      </button>
      <button type="button" onClick={onFindPrep} style={finderBtn}>
        <span style={finderTile}>
          <Stethoscope size={18} />
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {C.findPrep}
        </span>
        <MapPin
          size={16}
          style={{ color: "var(--text-subtle)", flex: "none" }}
        />
      </button>
    </Card>
  );
}

export function ReassureCard() {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        {C.reassureTitle}
      </div>
      {C.reassure.map((r) => (
        <div
          key={r}
          style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <span
            style={{
              color: "var(--status-clear-base)",
              flex: "none",
              marginTop: 1,
            }}
          >
            <Check size={18} />
          </span>
          <span
            style={{
              fontSize: 14,
              color: "var(--text-body)",
              lineHeight: 1.5,
            }}
          >
            {r}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function PrivacyNote() {
  return (
    <Card
      variant="tint"
      pad="sm"
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      <span style={{ color: "var(--text-accent)", flex: "none" }}>
        <Lock size={16} />
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          lineHeight: 1.45,
          color: "var(--text-body)",
        }}
      >
        {C.inAppNote}
      </span>
    </Card>
  );
}
