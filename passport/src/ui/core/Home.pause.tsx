import { Button } from "../../design/components/index.ts";
import { EyeOff, Lock, Clock, Eye } from "../../design/icons.tsx";
import { COPY, fmtDate } from "./Home.parts.tsx";
import { cx } from "../../lib/cx.ts";
import "./home.css";

// Owner-only pause panel. A viewer NEVER sees this or anything but gray;
// pausing renders identically to every other gray. Manual hide is liftable
// anytime; auto-pause (from a logged positive's clearance window) can be
// EXTENDED but not shortened below the guideline window. It holds its own
// actions, so it renders as the sanctioned action callout (.e-card, doc 37).
function AutoResumePanel({ untilLabel }: { untilLabel: string }) {
  const p = COPY.pause;
  return (
    <div className="hm__pause-until">
      <div className="hm__pause-until-row">
        <span className="hm__pause-until-label">{p.autoUntil}</span>
        <span className="hm__pause-until-date">{untilLabel}</span>
      </div>
      <div className="hm__pause-note">{p.autoNote}</div>
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
    <div className={cx("e-card", "hm__pause")}>
      <div className="hm__pause-head">
        <span aria-hidden className="hm__pause-icon">
          <EyeOff size={20} />
        </span>
        <div className="hm__pause-body">
          <div className="hm__pause-title">
            {autoPaused ? p.autoTitle : p.manualOn}
          </div>
          <div className="hm__pause-sub">
            {autoPaused ? p.autoSub : p.manualOnSub}
          </div>
        </div>
      </div>
      {autoPaused && <AutoResumePanel untilLabel={untilLabel} />}
      <div className="hm__pause-owner">
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
    </div>
  );
}
