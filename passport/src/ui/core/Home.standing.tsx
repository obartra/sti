import { Button } from "../../design/components/index.ts";
import { Care as CareIcon, Check, Heart } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import {
  STANDING_COPY,
  checklistRows,
  type Standing,
  type NextTest,
  type ChecklistRow,
} from "./Home.status.ts";
import type { ReportPreview } from "../../core/report.ts";
import "./home.css";

// The dashboard's lead: the owner's real standing in one line, serif with the
// status glyph beside it (doc 37). Blue reads blue; every gray reason
// (untested, lapsed, still-gray, paused) reads honestly, never green by
// default. This is the fix for a fresh owner reading as "Clear".
export function StandingLine({ standing }: { standing: Standing }) {
  const c = STANDING_COPY[standing];
  const blue = c.tone === "blue";
  return (
    <div>
      <div className="hm__standing-row">
        <span
          aria-hidden
          className={cx(
            "hm__standing-icon",
            blue ? "hm__standing-icon--blue" : "hm__standing-icon--gray",
          )}
        >
          <Heart size={16} />
        </span>
        <div className="hm__standing-title">{c.title}</div>
      </div>
      <div className="hm__standing-sub">{c.sub}</div>
    </div>
  );
}

// The prominent next-test line with a Find testing action. Overdue reads firm,
// not alarmist; an untested owner takes their first test.
export function NextTestCard({
  next,
  onFindTesting,
}: {
  next: NextTest;
  onFindTesting: (() => void) | undefined;
}) {
  return (
    <div className="hm__section hm__next">
      <div className="hm__next-body">
        <div className="hm__label">Next test</div>
        <div
          className={cx(
            "hm__next-value",
            next.overdue && "hm__next-value--overdue",
          )}
        >
          {next.label}
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<CareIcon size={15} />}
        onClick={onFindTesting}
      >
        Find testing
      </Button>
    </div>
  );
}

interface ChecklistActions {
  onReport: (() => void) | undefined;
  onFindTesting: (() => void) | undefined;
  onPrevention: (() => void) | undefined;
}

function actionFor(row: ChecklistRow, actions: ChecklistActions): () => void {
  const map = {
    test: actions.onReport,
    clear: actions.onFindTesting,
    route: actions.onPrevention,
  } as const;
  const run = map[row.kind];
  return run ?? (() => undefined);
}

function ChecklistItem({
  row,
  onAct,
}: {
  row: ChecklistRow;
  onAct: () => void;
}) {
  return (
    <div className="hm__check-row">
      <span
        aria-hidden
        className={cx(
          "hm__check-mark",
          row.met ? "hm__check-mark--met" : "hm__check-mark--open",
        )}
      >
        {row.met ? <Check size={16} /> : null}
      </span>
      <div className={cx("hm__check-title", row.met && "hm__check-title--met")}>
        {row.title}
      </div>
      {row.met ? null : (
        <Button variant="ghost" size="sm" onClick={onAct}>
          {row.action}
        </Button>
      )}
    </div>
  );
}

// The three things a blue card needs, each a met/unmet row plus the one action
// that advances it. The owner-only breakdown the badge collapses; never shared.
export function BlueChecklist({
  standing,
  actions,
}: {
  standing: ReportPreview;
  actions: ChecklistActions;
}) {
  return (
    <div className="hm__section hm__check">
      <div className="hm__label">For a blue card</div>
      {checklistRows(standing).map((row) => (
        <ChecklistItem
          key={row.kind}
          row={row}
          onAct={actionFor(row, actions)}
        />
      ))}
    </div>
  );
}
