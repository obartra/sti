import { useCallback, useEffect, useState } from "react";
import { Button, Segmented } from "../../design/components/index.ts";
import { Refresh, ShieldCheck } from "../../design/icons.tsx";
import { ReviewPanel, type ReviewOps } from "./ReviewPanel.tsx";
import { ActivityPanel, type AuditOps } from "./ActivityPanel.tsx";
import { MetricsPanel, type MetricsOps } from "./MetricsPanel.tsx";
import { HealthPanel, type HealthOps } from "./HealthPanel.tsx";
import { FeedbackPanel, type FeedbackOps } from "./FeedbackPanel.tsx";
import { AnswersPanel } from "./AnswersPanel.tsx";
import { ManagePanel, type ManageOps } from "./ManagePanel.tsx";
import "./admin.css";
import type { AdminMetrics } from "./adminApi.ts";

// The authed operator console (doc 20) in the editorial grammar (doc 37): a
// hairline-ruled dashboard shown once the token gate in AdminPage validates a
// bearer. Split out of AdminPage so each stays within its length ceiling;
// AdminPage owns the gate, this owns the composed panels. The console reads as
// four sections behind one tab bar, each a job: Overview (is anything on fire,
// what is waiting), Queues (the work itself), Metrics (how things are
// trending), Tools (the id lookup and the audit record).

export type AdminTab = "overview" | "queues" | "metrics" | "tools";

const TAB_OPTIONS: { value: AdminTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "queues", label: "Queues" },
  { value: "metrics", label: "Metrics" },
  { value: "tools", label: "Tools" },
];

const COPY = {
  authedTitle: "Admin",
  authedSub: "Operator session active.",
  lockAgain: "Lock",
  refreshAll: "Refresh",
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

// The overview's backlog strip: how much review work is waiting, from the same
// aggregate metrics read the Metrics tab uses (counts of opaque rows, never
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

// The console's masthead: the shield mark and session line, with the Refresh
// sweep and the Lock control on the right.
function ShellHead({
  onRefresh,
  onLock,
}: {
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
  onLock: () => void;
  onExpire: () => void;
  // Which section opens first; stories use it to capture each tab.
  initialTab?: AdminTab | undefined;
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  // One shared refresh signal: bumping it re-reads every auto-loading panel in place
  // (no remount), so an operator can pull fresh numbers across the console at once
  // instead of reloading the tab or retrying each panel. Panels on the other tabs
  // simply re-read when they next mount. The Manage tool is idle until an id is
  // typed, so it is deliberately left off the sweep.
  const [refreshSignal, setRefreshSignal] = useState(0);
  const refreshAll = useCallback(() => setRefreshSignal((n) => n + 1), []);
  return (
    <div className="adm">
      <ShellHead onRefresh={refreshAll} onLock={onLock} />
      <div className="adm-tabs">
        <Segmented
          options={TAB_OPTIONS}
          value={tab}
          onChange={setTab}
          aria-label={COPY.tabsLabel}
        />
      </div>
      {tab === "overview" && (
        <>
          <HealthPanel
            token={token}
            ops={healthOps}
            onUnauthorized={onExpire}
            refreshSignal={refreshSignal}
          />
          <BacklogPanel
            token={token}
            ops={metricsOps}
            onUnauthorized={onExpire}
            refreshSignal={refreshSignal}
          />
        </>
      )}
      {tab === "queues" && (
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
        </>
      )}
      {tab === "metrics" && (
        <MetricsPanel
          token={token}
          ops={metricsOps}
          onUnauthorized={onExpire}
          refreshSignal={refreshSignal}
        />
      )}
      {tab === "tools" && (
        <div className="adm-tools">
          <ManagePanel
            token={token}
            ops={manageOps}
            onUnauthorized={onExpire}
          />
          <ActivityPanel
            token={token}
            ops={auditOps}
            onUnauthorized={onExpire}
            refreshSignal={refreshSignal}
          />
        </div>
      )}
    </div>
  );
}
