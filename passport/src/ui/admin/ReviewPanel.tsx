import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import "./admin.css";
import type {
  AdminAction,
  AdminActionResult,
  AdminReport,
  AdminReportsResult,
} from "./adminApi.ts";

// The A2 Findable review panel: the queue of reported vanity names with two
// one-click reviewer actions per name. It is the in-app side of the doc 17/20
// takedown step; the server already auto-actions objective rule matches, so this
// is the subjective residual. A 401 from any call bubbles up so the page re-locks.

// The transport the panel needs, injected so tests and Storybook drive it without
// a server (and so AdminPage can bind it to its apiBase + token).
export interface ReviewOps {
  list: (token: string) => Promise<AdminReportsResult>;
  act: (
    token: string,
    name: string,
    action: AdminAction,
  ) => Promise<AdminActionResult>;
}

// Human labels for the fixed server reason codes.
const REASON_LABELS: Record<string, string> = {
  impersonation: "Impersonation",
  abuse: "Abuse",
  slur: "Slur",
  spam: "Spam",
  other: "Other",
};

const COPY = {
  title: "Reported names",
  sub: "Take a name down (revoke + 24h lock) or dismiss the report.",
  loading: "Loading reports…",
  empty: "No open reports. The namespace is clear.",
  loadError: "Couldn't load reports. Check your connection and try again.",
  actError: "That action didn't go through. Try again.",
  retry: "Retry",
  takedown: "Take down",
  dismiss: "Dismiss",
} as const;

const reportCount = (n: number) => `${n} report${n === 1 ? "" : "s"}`;

type Status = "loading" | "ready" | "loadError";

export function ReviewPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  ops: ReviewOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // the name being actioned
  const [actError, setActError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setActError(null);
    void ops
      .list(token)
      .then((r) => {
        if (r.kind === "ok") {
          setReports(r.reports);
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

  const act = useCallback(
    (name: string, action: AdminAction) => {
      setBusy(name);
      setActError(null);
      void ops
        .act(token, name, action)
        .then((r) => {
          setBusy(null);
          if (r === "ok") load();
          else if (r === "unauthorized") onUnauthorized();
          else setActError(COPY.actError);
        })
        .catch(() => {
          setBusy(null);
          setActError(COPY.actError);
        });
    },
    [ops, token, onUnauthorized, load],
  );

  return (
    <section className="adm-panel">
      <PanelHeading
        title={COPY.title}
        sub={COPY.sub}
        count={status === "ready" ? reports.length : undefined}
      />

      {status === "loading" && <div className="adm-note">{COPY.loading}</div>}

      {status === "loadError" && (
        <div className="adm-retry">
          <div className="adm-error">{COPY.loadError}</div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {status === "ready" && reports.length === 0 && (
        <div className="adm-note">{COPY.empty}</div>
      )}

      {status === "ready" && reports.length > 0 && (
        <div className="adm-list">
          {actError !== null && (
            <div className="adm-error adm-error--inline">{actError}</div>
          )}
          {reports.map((r) => (
            <ReportRow
              key={r.name}
              report={r}
              busy={busy === r.name}
              onAct={act}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportRow({
  report,
  busy,
  onAct,
}: {
  report: AdminReport;
  busy: boolean;
  onAct: (name: string, action: AdminAction) => void;
}) {
  return (
    <div className="adm-item">
      <div>
        <div className="adm-item__name">{report.name}</div>
        <div className="adm-item__meta">
          {reportCount(report.count)} ·{" "}
          {REASON_LABELS[report.reason] ?? "Other"}
        </div>
      </div>
      <div className="adm-item__actions">
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={() => onAct(report.name, "takedown")}
        >
          {COPY.takedown}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onAct(report.name, "dismiss")}
        >
          {COPY.dismiss}
        </Button>
      </div>
    </div>
  );
}
