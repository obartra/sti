import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import { formatUtc } from "./ActivityPanel.tsx";
import "./admin.css";
import type { AdminLogEntry, AdminLogsResult } from "./adminOpsApi.ts";

// The server-log panel (doc 20): the service's own recent log lines, read from
// the in-process buffer so the operator can see why an error counter moved
// without opening a shell on the box. Lines carry a static message, counts, and
// error values only, never an id, token, IP, or user-typed text (doc 12); the
// buffer starts empty on every restart, and the box's journal stays the deep
// archive. A 401 bubbles up so the page re-locks.

// The transport the panel needs, injected so tests and Storybook drive it
// without a server (and so AdminPage can bind it to its apiBase + token).
export interface LogsOps {
  list: (token: string) => Promise<AdminLogsResult>;
}

const COPY = {
  title: "Server log",
  sub: "What the service has written about itself since it last started. Counts and errors only, never facts about people.",
  loading: "Loading the log…",
  empty: "Nothing logged since the last restart.",
  loadError: "Couldn't load the log. Check your connection and try again.",
  retry: "Retry",
} as const;

type Status = "loading" | "ready" | "loadError";

// UTC like the other admin timestamps, guarded (toISOString throws on an
// invalid date, and one bad line must not blank the whole log).
function fmtTime(ms: number): string {
  try {
    return formatUtc(ms);
  } catch {
    return "";
  }
}

// The level's display class: errors and warnings get their inks, everything
// else stays quiet.
function levelClass(level: string): string {
  if (level === "ERROR") return "adm-log__level adm-log__level--error";
  if (level === "WARN") return "adm-log__level adm-log__level--warn";
  return "adm-log__level";
}

export function LogsPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  ops: LogsOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [entries, setEntries] = useState<AdminLogEntry[]>([]);

  const load = useCallback(() => {
    setStatus("loading");
    void ops
      .list(token)
      .then((r) => {
        if (r.kind === "ok") {
          setEntries(r.entries);
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
      <PanelHeading
        title={COPY.title}
        sub={COPY.sub}
        count={status === "ready" ? entries.length : undefined}
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

      {status === "ready" && entries.length === 0 && (
        <div className="adm-note">{COPY.empty}</div>
      )}

      {status === "ready" && entries.length > 0 && (
        <div className="adm-log">
          {entries.map((e, i) => (
            <div key={`${e.at}-${i}`} className="adm-log__row">
              <span className="adm-log__time">{fmtTime(e.at)}</span>
              <span className={levelClass(e.level)}>{e.level}</span>
              <span className="adm-log__msg">
                {e.msg}
                {e.attrs ? ` ${e.attrs}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
