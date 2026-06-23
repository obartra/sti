import { Card, Button, Switch, Badge } from "../../design/components/index.ts";
import { EyeOff, Trash, Users, Bell } from "../../design/icons.tsx";
import { COPY, Chip, fieldLbl } from "./Privacy.parts.tsx";
import type { Condoms, PrivacyState } from "./Privacy.parts.tsx";
import type { PushControls } from "../app/usePush.ts";

// What rides on the card besides the status, self-declared, optional.
export function AttributesCard({ state }: { state: PrivacyState }) {
  const condomChips: [Condoms, string][] = [
    ["off", COPY.condomOff],
    ["raw", COPY.condomRaw],
    ["either", COPY.condomEither],
    ["always", COPY.condomAlways],
  ];
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.attrsTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 3,
          }}
        >
          {COPY.attrsSub}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: "var(--text-strong)",
            }}
          >
            {COPY.hivLabel}
          </div>
          <div
            style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}
          >
            {COPY.hivLabelSub}
          </div>
        </div>
        <Switch checked={state.labelHiv} onChange={state.setLabelHiv} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderTop: "1px solid var(--divider)",
          paddingTop: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: "var(--text-strong)",
            }}
          >
            {COPY.doxyLabel}
          </div>
          <div
            style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}
          >
            {COPY.doxyLabelSub}
          </div>
        </div>
        <Switch checked={state.doxy} onChange={state.setDoxy} />
      </div>
      <div style={{ borderTop: "1px solid var(--divider)", paddingTop: 12 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {COPY.condomTitle}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 1,
          }}
        >
          {COPY.condomSub}
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}
        >
          {condomChips.map(([value, label]) => (
            <Chip
              key={value}
              active={state.condoms === value}
              onClick={() => state.setCondoms(value)}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>
    </Card>
  );
}

// Device push toggle (slice 7): an opt-in enhancement to the always-on in-app
// alerts. The heads-up is identical (contentless); this only changes WHERE it
// arrives (a closed-app notification). Disabled when the browser can't do push.
function PushRow({ push }: { push: PushControls }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
          <Bell size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-strong)",
            }}
          >
            {COPY.pushRow}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              marginTop: 2,
            }}
          >
            {push.supported ? COPY.pushRowSub : COPY.pushUnsupported}
          </div>
        </div>
        <Switch
          checked={push.enabled}
          disabled={!push.supported || push.busy}
          onChange={(on) => (on ? push.enable() : push.disable())}
        />
      </div>
      {push.error !== null && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--status-expired-fg)",
            marginLeft: 54,
          }}
        >
          {push.error}
        </div>
      )}
    </div>
  );
}

export function ControlsCard({
  state,
  push,
}: {
  state: PrivacyState;
  push?: PushControls | undefined;
}) {
  return (
    <>
      <div style={fieldLbl}>{COPY.controlsTitle}</div>
      <Card
        variant="flat"
        style={{ display: "flex", flexDirection: "column", gap: 4 }}
      >
        {/* Partner alerts are baked in: informational row, no switch. */}
        <div style={{ display: "flex", gap: 14, padding: "10px 8px" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-strong)",
                }}
              >
                {COPY.anonAlerts}
              </span>
              <span style={{ flex: "none", whiteSpace: "nowrap" }}>
                <Badge variant="accent">Always on</Badge>
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.5,
                marginTop: 2,
              }}
            >
              {COPY.anonAlertsSub}
            </div>
          </div>
        </div>
        {push && <PushRow push={push} />}
        {/* Manual pause: show plain gray to everyone (CtrlRow). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 8px",
          }}
        >
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
            <EyeOff size={20} />
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-strong)",
              }}
            >
              {COPY.pauseRow}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {COPY.pauseRowSub}
            </div>
          </div>
          <Switch checked={state.paused} onChange={state.setPaused} />
        </div>
      </Card>
    </>
  );
}

export function DangerZone({
  state,
  onDeleted,
}: {
  state: PrivacyState;
  onDeleted?: (() => void) | undefined;
}) {
  return (
    <>
      <div style={{ ...fieldLbl, color: "var(--status-expired-fg)" }}>
        {COPY.dangerTitle}
      </div>
      <Card
        variant="flat"
        style={{
          borderColor: "var(--expired-100)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: "var(--radius-sm)",
              background: "var(--expired-50)",
              color: "var(--status-expired-base)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash size={20} />
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-strong)",
              }}
            >
              {COPY.deleteTitle}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.45,
              }}
            >
              {COPY.deleteSub}
            </div>
          </div>
        </div>
        {!state.confirmDelete ? (
          <Button
            variant="danger"
            size="md"
            block
            onClick={() => state.setConfirmDelete(true)}
          >
            {COPY.deleteCta}
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="quiet"
              size="md"
              block
              onClick={() => state.setConfirmDelete(false)}
            >
              Keep it
            </Button>
            <Button variant="danger" size="md" block onClick={onDeleted}>
              Delete now
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
