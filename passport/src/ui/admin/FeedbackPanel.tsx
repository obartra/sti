import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import "./admin.css";
import type {
  AdminActionResult,
  AdminFeedback,
  AdminFeedbackResult,
} from "./adminApi.ts";

// The "Something wrong?" review panel (doc 35): the queue of reports filed through
// the public form, each with its category, the optional note the person typed, and a
// time, plus one action, Resolve, which deletes it once handled. The note is the one
// piece of user-typed text the store holds; this panel is where the operator reads
// it. A 401 from any call bubbles up so the page re-locks.

// The transport the panel needs, injected so tests and Storybook drive it without a
// server (and so AdminPage can bind it to its apiBase + token).
export interface FeedbackOps {
  list: (token: string) => Promise<AdminFeedbackResult>;
  resolve: (token: string, id: number) => Promise<AdminActionResult>;
}

// Human labels for the fixed server category codes.
const REASON_LABELS: Record<string, string> = {
  broken: "Something's broken",
  confusing: "Something's confusing",
  safety: "A safety concern",
  other: "Something else",
};

const COPY = {
  title: "Feedback",
  sub: 'What people sent through the "Something wrong?" form. Resolve when you have handled it.',
  loading: "Loading reports…",
  empty: "No open reports.",
  loadError: "Couldn't load reports. Check your connection and try again.",
  actError: "That didn't go through. Try again.",
  retry: "Retry",
  resolve: "Resolve",
  noNote: "No note.",
} as const;

type Status = "loading" | "ready" | "loadError";

export function FeedbackPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  ops: FeedbackOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [reports, setReports] = useState<AdminFeedback[]>([]);
  const [busy, setBusy] = useState<number | null>(null); // the id being resolved
  const [actError, setActError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setActError(null);
    void ops
      .list(token)
      .then((r) => {
        if (r.kind === "ok") {
          setReports(r.feedback);
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

  const resolve = useCallback(
    (id: number) => {
      setBusy(id);
      setActError(null);
      void ops
        .resolve(token, id)
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
            <FeedbackRow
              key={r.id}
              report={r}
              busy={busy === r.id}
              onResolve={resolve}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function fmtTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
}

function FeedbackRow({
  report,
  busy,
  onResolve,
}: {
  report: AdminFeedback;
  busy: boolean;
  onResolve: (id: number) => void;
}) {
  const note = report.body.trim();
  return (
    <div className="adm-item">
      <div className="adm-item__row">
        <div className="adm-item__name">
          {REASON_LABELS[report.reason] ?? "Something else"}
        </div>
        <div className="adm-item__time">{fmtTime(report.createdAt)}</div>
      </div>
      <div className="adm-item__body">{note === "" ? COPY.noNote : note}</div>
      <div className="adm-item__actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => onResolve(report.id)}
        >
          {COPY.resolve}
        </Button>
      </div>
    </div>
  );
}
