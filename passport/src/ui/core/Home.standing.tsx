import { Button, Card } from "../../design/components/index.ts";
import { Care as CareIcon, Check, Calendar } from "../../design/icons.tsx";
import { leadTile } from "./Home.parts.tsx";
import {
  STANDING_COPY,
  checklistRows,
  type Standing,
  type NextTest,
  type ChecklistRow,
} from "./Home.status.ts";
import type { ReportPreview } from "../../core/report.ts";

// The dashboard's lead: the owner's real standing in one line. Blue reads blue;
// every gray reason (untested, lapsed, still-gray, paused) reads honestly, never
// green by default. This is the fix for a fresh owner reading as "Clear".
export function StandingLine({ standing }: { standing: Standing }) {
  const c = STANDING_COPY[standing];
  const blue = c.tone === "blue";
  return (
    <Card
      variant="flat"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        borderColor: blue ? "var(--border-strong)" : undefined,
      }}
    >
      <span
        style={{
          ...leadTile,
          background: blue ? "var(--status-clear-bg)" : "var(--surface-sunken)",
          color: blue ? "var(--status-clear-base)" : "var(--text-muted)",
        }}
      >
        {blue ? <Check size={20} /> : <Calendar size={20} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 17, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {c.title}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{c.sub}</div>
      </div>
    </Card>
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
    <Card
      variant="flat"
      style={{ display: "flex", alignItems: "center", gap: 14 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Next test
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: next.overdue ? "var(--text-strong)" : "var(--text-body)",
          }}
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
    </Card>
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
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span
        style={{
          flex: "none",
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: row.met ? "var(--status-clear-bg)" : "transparent",
          color: row.met ? "var(--status-clear-base)" : "var(--text-subtle)",
          border: row.met ? "none" : "2px solid var(--border-card)",
        }}
      >
        {row.met ? <Check size={14} /> : null}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: 600,
          color: row.met ? "var(--text-strong)" : "var(--text-body)",
        }}
      >
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
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}
      >
        For a blue card
      </div>
      {checklistRows(standing).map((row) => (
        <ChecklistItem
          key={row.kind}
          row={row}
          onAct={actionFor(row, actions)}
        />
      ))}
    </Card>
  );
}
