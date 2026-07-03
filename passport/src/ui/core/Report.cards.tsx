import { Info, ShieldCheck } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import { COPY } from "./Report.parts.tsx";
import "./report.css";

// Core-panel coverage, owner-only guidance (doc 37): a quiet hairline-opened
// aside that gains a 3px clear left rule once the panel is covered; the
// still-needed list is plain text, never pills.
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
    <div className={cx("rp__core", done && "rp__core--done")}>
      <span aria-hidden className="rp__core-icon">
        {done ? <ShieldCheck size={19} /> : <Info size={19} />}
      </span>
      <div className="rp__core-body">
        <div className="rp__aside-title">{c.coreTitle}</div>
        <div className="rp__aside-text">
          {!touchedAny
            ? c.coreBody
            : coreComplete
              ? c.coreCovered
              : c.coreIncomplete}
        </div>
        {touchedAny && !coreComplete && coreMissing.length > 0 && (
          <div className="rp__core-missing">
            <span className="rp__core-missing-label">{c.coreMissingLabel}</span>
            {coreMissing.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
