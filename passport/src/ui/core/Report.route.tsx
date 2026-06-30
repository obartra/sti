import type { ReactNode } from "react";
import { Card, Switch } from "../../design/components/index.ts";
import { Check, ShieldCheck } from "../../design/icons.tsx";
import { COPY } from "./Report.parts.tsx";
import type { ReportPreview } from "../../core/report.ts";

// A single "what blue needs" requirement row: a met/unmet marker, a title, and a
// one-line why. Met is an accent check; unmet is a neutral hollow ring, never a
// red cross (this is guidance toward blue, not an error). Shared with the Home
// "where you stand" card.
export function CheckRow({
  met,
  title,
  sub,
}: {
  met: boolean;
  title: string;
  sub: string;
}) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <span
        style={{
          flex: "none",
          width: 22,
          height: 22,
          borderRadius: "50%",
          marginTop: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: met ? "var(--status-clear-bg)" : "transparent",
          color: met ? "var(--status-clear-base)" : "var(--text-subtle)",
          border: met ? "none" : "2px solid var(--border-card)",
        }}
      >
        {met ? <Check size={14} /> : null}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: met ? "var(--text-strong)" : "var(--text-body)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.45,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

// The live "what a blue card needs" checklist. All three requirements update as
// results and routes are entered; the footer states plainly whether the result
// will show blue, so a clean-but-gray panel never feels like a bug.
export function BlueReadiness({ preview }: { preview: ReportPreview }) {
  const c = COPY;
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <ShieldCheck size={18} />
        </span>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {c.blueTitle}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {c.blueSub}
          </div>
        </div>
      </div>
      <CheckRow
        met={preview.recentPanel}
        title={c.blueRecent}
        sub={c.blueRecentSub}
      />
      <CheckRow met={preview.clear} title={c.blueClear} sub={c.blueClearSub} />
      <CheckRow met={preview.route} title={c.blueRoute} sub={c.blueRouteSub} />
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: preview.willBeBlue
            ? "var(--status-clear-base)"
            : "var(--text-subtle)",
          borderTop: "1px solid var(--divider)",
          paddingTop: 11,
        }}
      >
        {preview.willBeBlue ? c.blueReady : c.blueNotReady}
      </div>
    </Card>
  );
}

function RouteToggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {label}
        </div>
        <Switch checked={checked} onChange={onChange} />
      </div>
      {hint ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// The two HIV-protection routes the owner sets directly (undetectable is set via
// the HIV result above). Writing the same owner state Settings does, so a route
// set here counts toward blue immediately.
export function RouteControls({
  prep,
  condoms,
  onPrep,
  onCondoms,
}: {
  prep: boolean;
  condoms: boolean;
  onPrep: (v: boolean) => void;
  onCondoms: (v: boolean) => void;
}) {
  const c = COPY;
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div>
        <div
          style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {c.routeTitle}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {c.routeSub}
        </div>
      </div>
      <RouteToggle checked={prep} onChange={onPrep} label={c.prepLabel} />
      <RouteToggle
        checked={condoms}
        onChange={onCondoms}
        label={c.condomsLabel}
        hint={c.condomsHint}
      />
    </Card>
  );
}
