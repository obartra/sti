import { useMemo } from "react";
import {
  actOnVanityName,
  disableAccount,
  getAdminMetrics,
  getAdminTrends,
  listAdminAudit,
  listAdminFeedback,
  listAdminReports,
  lookupRecord,
  pingAdmin,
  resolveFeedback,
  revokeAlias,
} from "./adminApi.ts";
import {
  clearAdminErrors,
  getAdminErrors,
  getAdminHealth,
  getAdminPerf,
  listAdminLogs,
  restartServer,
} from "./adminOpsApi.ts";
import type { ReviewOps } from "./ReviewPanel.tsx";
import type { AuditOps } from "./ActivityPanel.tsx";
import type { MetricsOps } from "./MetricsPanel.tsx";
import type { HealthOps } from "./HealthPanel.tsx";
import type { FeedbackOps } from "./FeedbackPanel.tsx";
import type { ManageOps } from "./ManagePanel.tsx";
import type { LogsOps } from "./LogsPanel.tsx";
import type { RestartOps } from "./RestartPanel.tsx";
import type { ErrorsOps } from "./ErrorsPanel.tsx";

// The console's panel transports: each defaults to the real admin endpoints
// bound to apiBase, or uses the injected stub (tests / Storybook). Split out of
// AdminPage so the page stays within its length ceiling and owns only the gate
// and the composition.

export interface AdminTransportOverrides {
  reviewOps?: ReviewOps | undefined;
  auditOps?: AuditOps | undefined;
  metricsOps?: MetricsOps | undefined;
  healthOps?: HealthOps | undefined;
  feedbackOps?: FeedbackOps | undefined;
  manageOps?: ManageOps | undefined;
  logsOps?: LogsOps | undefined;
  restartOps?: RestartOps | undefined;
  errorsOps?: ErrorsOps | undefined;
}

export interface AdminTransports {
  ops: ReviewOps;
  audit: AuditOps;
  metrics: MetricsOps;
  health: HealthOps;
  feedback: FeedbackOps;
  manage: ManageOps;
  logs: LogsOps;
  restart: RestartOps;
  errors: ErrorsOps;
}

export function useAdminTransports(
  apiBase: string,
  over: AdminTransportOverrides,
): AdminTransports {
  const {
    reviewOps,
    auditOps,
    metricsOps,
    healthOps,
    feedbackOps,
    manageOps,
    logsOps,
    restartOps,
    errorsOps,
  } = over;
  const ops = useMemo<ReviewOps>(
    () =>
      reviewOps ?? {
        list: (t) => listAdminReports(apiBase, t),
        act: (t, name, action) =>
          actOnVanityName({ apiBase, token: t, name, action }),
      },
    [reviewOps, apiBase],
  );
  const audit = useMemo<AuditOps>(
    () =>
      auditOps ?? { list: (t, before) => listAdminAudit(apiBase, t, before) },
    [auditOps, apiBase],
  );
  const metrics = useMemo<MetricsOps>(
    () =>
      metricsOps ?? {
        get: (t) => getAdminMetrics(apiBase, t),
        getTrends: (t) => getAdminTrends(apiBase, t),
        getPerf: (t) => getAdminPerf(apiBase, t),
      },
    [metricsOps, apiBase],
  );
  const health = useMemo<HealthOps>(
    () => healthOps ?? { get: (t) => getAdminHealth(apiBase, t) },
    [healthOps, apiBase],
  );
  const feedback = useMemo<FeedbackOps>(
    () =>
      feedbackOps ?? {
        list: (t) => listAdminFeedback(apiBase, t),
        resolve: (t, id) => resolveFeedback(apiBase, t, id),
      },
    [feedbackOps, apiBase],
  );
  const manage = useMemo<ManageOps>(
    () =>
      manageOps ?? {
        lookup: (t, id) => lookupRecord(apiBase, t, id),
        disable: (t, id) => disableAccount(apiBase, t, id),
        revoke: (t, id) => revokeAlias(apiBase, t, id),
      },
    [manageOps, apiBase],
  );
  const logs = useMemo<LogsOps>(
    () => logsOps ?? { list: (t) => listAdminLogs(apiBase, t) },
    [logsOps, apiBase],
  );
  // The restart probe reuses the same cheap ping the token gate validates with.
  const restart = useMemo<RestartOps>(
    () =>
      restartOps ?? {
        restart: (t) => restartServer(apiBase, t),
        ping: (t) => pingAdmin(apiBase, t),
      },
    [restartOps, apiBase],
  );
  // The errors panel reads the per-day buckets plus the ERROR-level log lines
  // (the issues rollup), and owns the audited clear.
  const errors = useMemo<ErrorsOps>(
    () =>
      errorsOps ?? {
        get: (t) => getAdminErrors(apiBase, t),
        errorLines: (t) => listAdminLogs(apiBase, t, { level: "error" }),
        clear: (t) => clearAdminErrors(apiBase, t),
      },
    [errorsOps, apiBase],
  );
  return {
    ops,
    audit,
    metrics,
    health,
    feedback,
    manage,
    logs,
    restart,
    errors,
  };
}
