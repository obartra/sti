import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import { ConfirmButton } from "./ManagePanel.tsx";
import { formatUtc } from "./ActivityPanel.tsx";
import { DailyStackedBars, dayLabel } from "./adminCharts.tsx";
import "./admin.css";
import type { AdminActionResult } from "./adminApi.ts";
import type {
  AdminErrors,
  AdminErrorsResult,
  AdminLogEntry,
  AdminLogsResult,
} from "./adminOpsApi.ts";

// The errors panel (doc 20), on the Overview so the alarm and its cause share
// one screen: the per-day error chart by subsystem, today/lifetime figures, the
// distinct problems rolled up from the error log lines (message, count, last
// seen), and the audited clear of the lifetime totals. Aggregate counts and
// invariant-bounded log lines only (doc 12), never a message with an id, IP,
// or user-typed text in it.

// The transport the panel needs, injected so tests and Storybook drive it
// without a server. `errorLines` is the log read filtered to ERROR level, the
// raw material for the issues rollup.
export interface ErrorsOps {
  get: (token: string) => Promise<AdminErrorsResult>;
  errorLines: (token: string) => Promise<AdminLogsResult>;
  clear: (token: string) => Promise<AdminActionResult>;
}

const COPY = {
  title: "Errors",
  sub: "What has gone wrong, by day and by subsystem. Lifetime totals survive restarts; the chart is the history.",
  loading: "Loading errors…",
  loadError: "Couldn't load errors. Check your connection and try again.",
  retry: "Retry",
  chartTitle: "Errors per day",
  todayLabel: "Today",
  lifetimeLabel: "All time",
  issuesLabel: "Distinct problems in the recent log",
  noIssues: "No error lines in the recent log.",
  clearIdle: "Clear the totals",
  clearConfirm: "Confirm: totals restart at zero. The chart keeps the history.",
  clearError: "That didn't go through. Try again.",
  lastSeen: "last",
} as const;

// The four fixed subsystems, with the same friendly names the health band uses
// and a distinct ink each for the stacked chart. Tokens only, no raw color.
const SUBSYSTEMS = [
  { key: "store", label: "Storage", color: "var(--text-accent)" },
  { key: "enqueue", label: "Send queue", color: "var(--status-ink-treat)" },
  {
    key: "janitor",
    label: "Background loop",
    color: "var(--status-expired-fg)",
  },
  { key: "decode", label: "Decode", color: "var(--status-ink-none)" },
] as const;

type Status = "loading" | "ready" | "loadError";

// One distinct problem: an error message, how often it appears in the recent
// log, and when it was last seen. Grouping by the fixed message is what turns
// a log tail into a short list of issues.
interface Issue {
  msg: string;
  count: number;
  lastAt: number;
}

function rollUp(lines: AdminLogEntry[]): Issue[] {
  const byMsg = new Map<string, Issue>();
  for (const l of lines) {
    const got = byMsg.get(l.msg);
    if (got) {
      got.count += 1;
      if (l.at > got.lastAt) got.lastAt = l.at;
    } else {
      byMsg.set(l.msg, { msg: l.msg, count: 1, lastAt: l.at });
    }
  }
  return [...byMsg.values()].sort((a, b) => b.lastAt - a.lastAt);
}

function fmtTime(ms: number): string {
  try {
    return formatUtc(ms);
  } catch {
    return "";
  }
}

const sumDay = (d: AdminErrors["days"][number]) =>
  d.store + d.enqueue + d.janitor + d.decode;

// The issues rollup rows: each distinct message with its count and last-seen.
function IssuesList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return <div className="adm-note">{COPY.noIssues}</div>;
  }
  return (
    <div className="adm-log">
      {issues.map((i) => (
        <div key={i.msg} className="adm-log__row">
          <span className="adm-log__time">
            {COPY.lastSeen} {fmtTime(i.lastAt)}
          </span>
          <span className="adm-log__level adm-log__level--error">
            {i.count}x
          </span>
          <span className="adm-log__msg">{i.msg}</span>
        </div>
      ))}
    </div>
  );
}

// The loaded panel body: today/lifetime figures, the stacked chart, the issues
// rollup, and the clear control. Split out so ErrorsPanel itself stays within
// its length ceiling and owns only the load/act state machine.
function ErrorsBody({
  errors,
  issues,
  busy,
  actError,
  onClear,
}: {
  errors: AdminErrors;
  issues: Issue[];
  busy: boolean;
  actError: string | null;
  onClear: () => void;
}) {
  const rows = errors.days.map((d) => ({ label: dayLabel(d.day), ...d }));
  const today = errors.days.at(-1);
  const todaySum = today ? sumDay(today) : 0;
  const lifetime = errors.totals.reduce((n, t) => n + t.count, 0);
  return (
    <div className="adm-answers">
      {actError !== null && (
        <div className="adm-error adm-error--inline">{actError}</div>
      )}
      <div className="adm-figures adm-figures--compact">
        <div
          className={
            todaySum > 0 ? "adm-figure adm-figure--warn" : "adm-figure"
          }
        >
          <div className="adm-figure__value">{todaySum}</div>
          <div className="adm-figure__label">{COPY.todayLabel}</div>
        </div>
        <div className="adm-figure">
          <div className="adm-figure__value">{lifetime}</div>
          <div className="adm-figure__label">{COPY.lifetimeLabel}</div>
        </div>
      </div>
      <DailyStackedBars
        title={COPY.chartTitle}
        rows={rows}
        series={SUBSYSTEMS.map((s) => ({
          key: s.key,
          label: s.label,
          color: s.color,
        }))}
      />
      <div className="adm-answers__group">
        <div className="e-eyebrow">{COPY.issuesLabel}</div>
        <IssuesList issues={issues} />
      </div>
      <div className="adm-item__actions">
        <ConfirmButton
          idle={COPY.clearIdle}
          confirm={COPY.clearConfirm}
          busy={busy}
          onConfirm={onClear}
        />
      </div>
    </div>
  );
}

export function ErrorsPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  ops: ErrorsOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [errors, setErrors] = useState<AdminErrors | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState(false);
  const [actError, setActError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setActError(null);
    void Promise.all([ops.get(token), ops.errorLines(token)])
      .then(([e, l]) => {
        if (e.kind === "unauthorized" || l.kind === "unauthorized") {
          onUnauthorized();
          return;
        }
        if (e.kind !== "ok" || l.kind !== "ok") {
          setStatus("loadError");
          return;
        }
        setErrors(e.errors);
        setIssues(rollUp(l.entries));
        setStatus("ready");
      })
      .catch(() => setStatus("loadError"));
  }, [ops, token, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const clear = useCallback(() => {
    setBusy(true);
    setActError(null);
    void ops
      .clear(token)
      .then((r) => {
        setBusy(false);
        if (r === "ok") load();
        else if (r === "unauthorized") onUnauthorized();
        else setActError(COPY.clearError);
      })
      .catch(() => {
        setBusy(false);
        setActError(COPY.clearError);
      });
  }, [ops, token, onUnauthorized, load]);

  return (
    <section className="adm-panel">
      <PanelHeading title={COPY.title} sub={COPY.sub} />

      {status === "loading" && <div className="adm-note">{COPY.loading}</div>}

      {status === "loadError" && (
        <div className="adm-retry">
          <div className="adm-error">{COPY.loadError}</div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {status === "ready" && errors !== null && (
        <ErrorsBody
          errors={errors}
          issues={issues}
          busy={busy}
          actError={actError}
          onClear={clear}
        />
      )}
    </section>
  );
}
