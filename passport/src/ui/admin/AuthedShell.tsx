import { useCallback, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { Refresh, ShieldCheck } from "../../design/icons.tsx";
import { ReviewPanel, type ReviewOps } from "./ReviewPanel.tsx";
import { ActivityPanel, type AuditOps } from "./ActivityPanel.tsx";
import { MetricsPanel, type MetricsOps } from "./MetricsPanel.tsx";
import { HealthPanel, type HealthOps } from "./HealthPanel.tsx";
import { FeedbackPanel, type FeedbackOps } from "./FeedbackPanel.tsx";
import { ManagePanel, type ManageOps } from "./ManagePanel.tsx";
import "./admin.css";

// The authed operator console (doc 20) in the editorial grammar (doc 37): a
// hairline-ruled column of panels shown once the token gate in AdminPage validates a
// bearer. Split out of AdminPage so each stays within its length ceiling; AdminPage
// owns the gate, this owns the composed panels. The queues split to two columns via a
// container query on the console, not a JS breakpoint.

const COPY = {
  authedTitle: "Admin",
  authedSub: "Operator session active.",
  lockAgain: "Lock",
  refreshAll: "Refresh",
} as const;

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
}) {
  // One shared refresh signal: bumping it re-reads every auto-loading panel in place
  // (no remount), so an operator can pull fresh numbers across the console at once
  // instead of reloading the tab or retrying each panel. The Manage tool is idle
  // until an id is typed, so it is deliberately left off the sweep.
  const [refreshSignal, setRefreshSignal] = useState(0);
  const refreshAll = useCallback(() => setRefreshSignal((n) => n + 1), []);
  return (
    <div className="adm">
      <div className="adm-head">
        <span className="adm-head__mark">
          <ShieldCheck size={20} />
        </span>
        <div className="adm-head__body">
          <h1 className="adm-head__title">{COPY.authedTitle}</h1>
          <div className="adm-head__sub">{COPY.authedSub}</div>
        </div>
        <div className="adm-head__actions">
          <Button variant="ghost" size="sm" onClick={refreshAll}>
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
      {/* Health first (how the box is running right now), then the stored totals and
          trends, then the work queues, then the management tool and the audit log:
          a top-to-bottom operator read from live state down to the record of actions. */}
      <HealthPanel
        token={token}
        ops={healthOps}
        onUnauthorized={onExpire}
        refreshSignal={refreshSignal}
      />
      <MetricsPanel
        token={token}
        ops={metricsOps}
        onUnauthorized={onExpire}
        refreshSignal={refreshSignal}
      />
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
      {/* The Manage tool sits apart from the queues above: it acts on a raw
          operator-typed id, not on a queued item, so it is its own section. */}
      <ManagePanel token={token} ops={manageOps} onUnauthorized={onExpire} />
      <ActivityPanel
        token={token}
        ops={auditOps}
        onUnauthorized={onExpire}
        refreshSignal={refreshSignal}
      />
    </div>
  );
}
