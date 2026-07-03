import { useCallback, useEffect, useState } from "react";
import { Button, Segmented, Switch } from "../../design/components/index.ts";
import { Refresh, ShieldCheck } from "../../design/icons.tsx";
import { ReviewPanel, type ReviewOps } from "./ReviewPanel.tsx";
import { ActivityPanel, type AuditOps } from "./ActivityPanel.tsx";
import { MetricsPanel, type MetricsOps } from "./MetricsPanel.tsx";
import { HealthPanel, type HealthOps } from "./HealthPanel.tsx";
import { FeedbackPanel, type FeedbackOps } from "./FeedbackPanel.tsx";
import { AnswersPanel } from "./AnswersPanel.tsx";
import { ManagePanel, type ManageOps } from "./ManagePanel.tsx";
import { LogsPanel, type LogsOps } from "./LogsPanel.tsx";
import { RestartPanel, type RestartOps } from "./RestartPanel.tsx";
import { ErrorsPanel, type ErrorsOps } from "./ErrorsPanel.tsx";
import { QueueTrendsPanel } from "./QueueTrendsPanel.tsx";
import "./admin.css";
import type { AdminMetrics } from "./adminApi.ts";

// The authed operator console (doc 20) in the editorial grammar (doc 37): a
// hairline-ruled dashboard shown once the token gate in AdminPage validates a
// bearer. Split out of AdminPage so each stays within its length ceiling;
// AdminPage owns the gate, this owns the composed panels. Four sections behind
// one tab bar, organized by job, with each signal beside the place you act on
// it: Overview (is anything wrong, and why: health, the waiting work, the
// errors), Queues (the work plus the queue's own trends), Usage (growth,
// traffic, capacity), Tools (the id lookup, the audit tail, the server log,
// restart).

export type AdminTab = "overview" | "queues" | "usage" | "tools";

const COPY = {
  authedTitle: "Admin",
  authedSub: "Operator session active.",
  lockAgain: "Lock",
  refreshAll: "Refresh",
  autoRefresh: "Auto-refresh",
  tabsLabel: "Console sections",
  backlogTitle: "Waiting for review",
  backlogSub:
    "Reports and responses that need a human. Work through them on the Queues tab.",
  backlogLoading: "Counting the backlog…",
  backlogError:
    "Couldn't load the backlog. Check your connection and try again.",
  retry: "Retry",
  reportsFigure: "Reported names",
  feedbackFigure: "Feedback and answers",
} as const;

// How often auto-refresh sweeps the panels when the operator turns it on.
const AUTO_REFRESH_MS = 60_000;

// The tab bar options; the Overview label carries a quiet warn dot while the
// box needs a look, so the fire indicator is visible from any tab.
function tabOptions(needsLook: boolean) {
  return [
    {
      value: "overview" as const,
      label: (
        <span className="adm-tab-label">
          Overview
          {needsLook && (
            <span className="adm-tab-dot" aria-label="needs a look" />
          )}
        </span>
      ),
    },
    { value: "queues" as const, label: "Queues" },
    { value: "usage" as const, label: "Usage" },
    { value: "tools" as const, label: "Tools" },
  ];
}

// The overview's backlog strip: how much review work is waiting, from the same
// aggregate metrics read the Usage tab uses (counts of opaque rows, never
// facts about people, doc 12/20). The queues themselves live on the Queues
// tab; this is the glance that says whether to go there.
function BacklogPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal,
}: {
  token: string;
  ops: MetricsOps;
  onUnauthorized: () => void;
  refreshSignal: number;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "loadError">(
    "loading",
  );
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    void ops
      .get(token)
      .then((r) => {
        if (r.kind === "ok") {
          setMetrics(r.metrics);
          setStatus("ready");
        } else if (r.kind === "unauthorized") {
          onUnauthorized();
        } else {
          setStatus("loadError");
        }
      })
      .catch(() => setStatus("loadError"));
  }, [ops, token, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  return (
    <section className="adm-panel">
      <div className="adm-panel__head">
        <div className="adm-panel__headings">
          <h2 className="adm-panel__title">{COPY.backlogTitle}</h2>
          <div className="adm-panel__sub">{COPY.backlogSub}</div>
        </div>
      </div>
      {status === "loading" && (
        <div className="adm-note">{COPY.backlogLoading}</div>
      )}
      {status === "loadError" && (
        <div className="adm-retry">
          <div className="adm-error">{COPY.backlogError}</div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}
      {status === "ready" && metrics !== null && (
        <div className="adm-figures">
          <div
            className={
              metrics.pendingReports > 0
                ? "adm-figure adm-figure--warn"
                : "adm-figure"
            }
          >
            <div className="adm-figure__value">{metrics.pendingReports}</div>
            <div className="adm-figure__label">{COPY.reportsFigure}</div>
          </div>
          <div
            className={
              metrics.pendingFeedback > 0
                ? "adm-figure adm-figure--warn"
                : "adm-figure"
            }
          >
            <div className="adm-figure__value">{metrics.pendingFeedback}</div>
            <div className="adm-figure__label">{COPY.feedbackFigure}</div>
          </div>
        </div>
      )}
    </section>
  );
}

// The console's masthead: the shield mark and session line, with auto-refresh,
// the manual Refresh sweep, and the Lock control on the right.
function ShellHead({
  auto,
  onAuto,
  onRefresh,
  onLock,
}: {
  auto: boolean;
  onAuto: (on: boolean) => void;
  onRefresh: () => void;
  onLock: () => void;
}) {
  return (
    <div className="adm-head">
      <span className="adm-head__mark">
        <ShieldCheck size={20} />
      </span>
      <div className="adm-head__body">
        <h1 className="adm-head__title">{COPY.authedTitle}</h1>
        <div className="adm-head__sub">{COPY.authedSub}</div>
      </div>
      <div className="adm-head__actions">
        <Switch checked={auto} onChange={onAuto} label={COPY.autoRefresh} />
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <span className="adm-btn-icon">
            <Refresh size={15} />
            {COPY.refreshAll}
          </span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onLock}>
          {COPY.lockAgain}
        </Button>
      </div>
    </div>
  );
}

export function AuthedShell({
  token,
  ops,
  auditOps,
  metricsOps,
  healthOps,
  feedbackOps,
  manageOps,
  logsOps,
  restartOps,
  errorsOps,
  onLock,
  onExpire,
  initialTab = "overview",
}: {
  token: string;
  ops: ReviewOps;
  auditOps: AuditOps;
  metricsOps: MetricsOps;
  healthOps: HealthOps;
  feedbackOps: FeedbackOps;
  manageOps: ManageOps;
  logsOps: LogsOps;
  restartOps: RestartOps;
  errorsOps: ErrorsOps;
  onLock: () => void;
  onExpire: () => void;
  // Which section opens first; stories use it to capture each tab.
  initialTab?: AdminTab | undefined;
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  // One shared refresh signal: bumping it re-reads every auto-loading panel in
  // place (no remount), so an operator can pull fresh numbers across the whole
  // console at once. The Manage tool is idle until an id is typed, so it is
  // deliberately left off the sweep. Auto-refresh bumps the same signal on a
  // timer for a console left open.
  const [refreshSignal, setRefreshSignal] = useState(0);
  const refreshAll = useCallback(() => setRefreshSignal((n) => n + 1), []);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refreshAll, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [auto, refreshAll]);
  // The health read reports whether the box needs a look; the Overview tab
  // label carries the dot so the signal survives switching tabs.
  const [needsLook, setNeedsLook] = useState(false);
  // Every section stays mounted; switching tabs only flips the `hidden`
  // attribute. Panels load once at unlock and keep their data, so a switch is
  // instant instead of remounting into a "Loading…" flash.
  return (
    <div className="adm">
      <ShellHead
        auto={auto}
        onAuto={setAuto}
        onRefresh={refreshAll}
        onLock={onLock}
      />
      <div className="adm-tabs">
        <Segmented
          options={tabOptions(needsLook)}
          value={tab}
          onChange={setTab}
          aria-label={COPY.tabsLabel}
        />
      </div>
      <div className="adm-section" hidden={tab !== "overview"}>
        <HealthPanel
          token={token}
          ops={healthOps}
          onUnauthorized={onExpire}
          onStatusChange={setNeedsLook}
          refreshSignal={refreshSignal}
        />
        <BacklogPanel
          token={token}
          ops={metricsOps}
          onUnauthorized={onExpire}
          refreshSignal={refreshSignal}
        />
        <ErrorsPanel
          token={token}
          ops={errorsOps}
          onUnauthorized={onExpire}
          refreshSignal={refreshSignal}
        />
      </div>
      <div className="adm-section" hidden={tab !== "queues"}>
        <QueuesSection
          token={token}
          ops={ops}
          feedbackOps={feedbackOps}
          metricsOps={metricsOps}
          onExpire={onExpire}
          refreshSignal={refreshSignal}
        />
      </div>
      <div className="adm-section" hidden={tab !== "usage"}>
        <MetricsPanel
          token={token}
          ops={metricsOps}
          onUnauthorized={onExpire}
          refreshSignal={refreshSignal}
        />
      </div>
      <div className="adm-section" hidden={tab !== "tools"}>
        <ToolsSection
          token={token}
          manageOps={manageOps}
          auditOps={auditOps}
          logsOps={logsOps}
          restartOps={restartOps}
          onExpire={onExpire}
          onRestarted={refreshAll}
          refreshSignal={refreshSignal}
        />
      </div>
    </div>
  );
}

// The Queues section: both work queues, the labs answers view, and the queue's
// own trends. Split out so AuthedShell stays within its length ceiling.
function QueuesSection({
  token,
  ops,
  feedbackOps,
  metricsOps,
  onExpire,
  refreshSignal,
}: {
  token: string;
  ops: ReviewOps;
  feedbackOps: FeedbackOps;
  metricsOps: MetricsOps;
  onExpire: () => void;
  refreshSignal: number;
}) {
  return (
    <>
      <div className="adm-queues">
        <ReviewPanel
          token={token}
          ops={ops}
          onUnauthorized={onExpire}
          refreshSignal={refreshSignal}
        />
        <FeedbackPanel
          token={token}
          ops={feedbackOps}
          onUnauthorized={onExpire}
          refreshSignal={refreshSignal}
        />
      </div>
      <AnswersPanel
        token={token}
        ops={feedbackOps}
        onUnauthorized={onExpire}
        refreshSignal={refreshSignal}
      />
      <QueueTrendsPanel
        token={token}
        ops={metricsOps}
        onUnauthorized={onExpire}
        refreshSignal={refreshSignal}
      />
    </>
  );
}

// The Tools section: the id lookup beside the audit tail, the server log, and
// the restart control. Split out for the same length reason.
function ToolsSection({
  token,
  manageOps,
  auditOps,
  logsOps,
  restartOps,
  onExpire,
  onRestarted,
  refreshSignal,
}: {
  token: string;
  manageOps: ManageOps;
  auditOps: AuditOps;
  logsOps: LogsOps;
  restartOps: RestartOps;
  onExpire: () => void;
  onRestarted: () => void;
  refreshSignal: number;
}) {
  return (
    <>
      <div className="adm-tools">
        <ManagePanel token={token} ops={manageOps} onUnauthorized={onExpire} />
        <ActivityPanel
          token={token}
          ops={auditOps}
          onUnauthorized={onExpire}
          refreshSignal={refreshSignal}
        />
      </div>
      <LogsPanel
        token={token}
        ops={logsOps}
        onUnauthorized={onExpire}
        refreshSignal={refreshSignal}
      />
      <RestartPanel
        token={token}
        ops={restartOps}
        onUnauthorized={onExpire}
        onRestarted={onRestarted}
      />
    </>
  );
}
