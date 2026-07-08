import { useId, type ReactNode } from "react";
import { Switch } from "../../design/components/index.ts";
import { Check, ShieldCheck } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import { COPY } from "./Report.parts.tsx";
import type { ReportPreview } from "../../core/report.ts";
import "./report.css";

// A single "what blue needs" requirement row: a met/unmet marker, a title, and a
// one-line why. Met is a clear-ink check; unmet is a neutral hollow ring, never a
// red cross (this is guidance toward blue, not an error). Used by the Report
// blue-readiness section; the Home checklist has its own compact, action-per-row form.
function CheckRow({
  met,
  title,
  sub,
}: {
  met: boolean;
  title: string;
  sub: string;
}) {
  return (
    <div className="rp__check-row">
      <span
        aria-hidden
        className={cx(
          "rp__check-mark",
          met ? "rp__check-mark--met" : "rp__check-mark--open",
        )}
      >
        {met ? <Check size={16} /> : null}
      </span>
      <div className="rp__check-body">
        <div className={cx("rp__check-title", met && "rp__check-title--met")}>
          {title}
        </div>
        <div className="rp__check-sub">{sub}</div>
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
    <div className="rp__ready">
      <div className="rp__ready-head">
        <span aria-hidden className="rp__ready-icon">
          <ShieldCheck size={18} />
        </span>
        <div>
          <div className="rp__ready-title">{c.blueTitle}</div>
          <div className="rp__ready-sub">{c.blueSub}</div>
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
        className={cx(
          "rp__verdict",
          preview.willBeBlue && "rp__verdict--ready",
        )}
      >
        {preview.willBeBlue ? c.blueReady : c.blueNotReady}
      </div>
    </div>
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
  const id = useId();
  return (
    <div className="rp__toggle">
      <div className="rp__toggle-row">
        <label className="rp__toggle-label" htmlFor={id}>
          {label}
        </label>
        <Switch id={id} checked={checked} onChange={onChange} />
      </div>
      {hint ? <div className="rp__toggle-hint">{hint}</div> : null}
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
    <div className="rp__routes">
      <div>
        <div className="rp__routes-title">{c.routeTitle}</div>
        <div className="rp__routes-sub">{c.routeSub}</div>
      </div>
      <RouteToggle checked={prep} onChange={onPrep} label={c.prepLabel} />
      <RouteToggle
        checked={condoms}
        onChange={onCondoms}
        label={c.condomsLabel}
        hint={c.condomsHint}
      />
    </div>
  );
}
