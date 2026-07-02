import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import "./admin.css";
import {
  AUDIT_PAGE,
  type AdminAuditEntry,
  type AdminAuditResult,
} from "./adminApi.ts";

// The A4 recent-activity panel (doc 20): a read-only tail of the admin audit log,
// newest first. It is the read surface for the "reconstructable" guarantee the rest
// of doc 20 leans on; before this the log was only reachable via SQLite on the box.
// Read-only by design (no actions). A 401 from the load bubbles up so the page
// re-locks, like the review panel.

// The transport the panel needs, injected so tests and Storybook drive it without a
// server (and so AdminPage can bind it to its apiBase + token).
export interface AuditOps {
  // `before` is a row-id cursor (0/omitted = newest page); used to page older.
  list: (token: string, before?: number) => Promise<AdminAuditResult>;
}

// Human labels for the fixed server action verbs (admin.go's audit constants).
const ACTION_LABELS: Record<string, string> = {
  ping: "Session opened",
  "vanity.takedown": "Name taken down",
  "vanity.takedown.auto": "Name auto-taken-down",
  "vanity.dismiss": "Report dismissed",
  "account.disable": "Account disabled",
  "alias.revoke": "Alias revoked",
};

const COPY = {
  title: "Recent activity",
  sub: "The most recent admin actions, newest first.",
  loading: "Loading activity…",
  empty: "No admin actions recorded yet.",
  loadError: "Couldn't load activity. Check your connection and try again.",
  retry: "Retry",
  refresh: "Refresh",
  loadOlder: "Load older",
  loadingOlder: "Loading…",
} as const;

// Format an epoch-ms instant as a fixed UTC string ("2026-06-25 14:30 UTC"). UTC
// keeps it deterministic regardless of the viewer's (or the visual runner's)
// timezone, and absolute time is what an operator audit wants. Exported so the
// Manage panel dates a looked-up record's last-written time the same way.
export function formatUtc(ms: number): string {
  const iso = new Date(ms).toISOString(); // 2026-06-25T14:30:00.000Z
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

type Status = "loading" | "ready" | "loadError";

export function ActivityPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  ops: AuditOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read (alongside this panel's own
  // Refresh button, which reloads just the activity tail).
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  // A full page back means older entries may exist (the "load older" affordance).
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(() => {
    setStatus("loading");
    void ops
      .list(token)
      .then((r) => {
        if (r.kind === "ok") {
          setEntries(r.entries);
          setHasMore(r.entries.length === AUDIT_PAGE);
          setStatus("ready");
        } else if (r.kind === "unauthorized") {
          onUnauthorized();
        } else {
          setStatus("loadError");
        }
      })
      .catch(() => setStatus("loadError"));
  }, [ops, token, onUnauthorized]);

  // Page older entries after the oldest one shown (its id is the cursor). Appends;
  // a short page means we've reached the bottom. A 401 still re-locks the page.
  const loadMore = useCallback(() => {
    const oldest = entries[entries.length - 1];
    if (oldest === undefined || loadingMore) return;
    setLoadingMore(true);
    void ops
      .list(token, oldest.id)
      .then((r) => {
        if (r.kind === "ok") {
          setEntries((prev) => [...prev, ...r.entries]);
          setHasMore(r.entries.length === AUDIT_PAGE);
        } else if (r.kind === "unauthorized") {
          onUnauthorized();
        }
        // A transient error just leaves the button for a retry.
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }, [ops, token, entries, loadingMore, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  return (
    <section className="adm-panel">
      <div className="adm-panel__head">
        <div className="adm-panel__headings">
          <h2 className="adm-panel__title">{COPY.title}</h2>
          <div className="adm-panel__sub">{COPY.sub}</div>
        </div>
        {status === "ready" && (
          <Button variant="ghost" size="sm" onClick={load}>
            {COPY.refresh}
          </Button>
        )}
      </div>

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
        <div className="adm-list">
          {entries.map((e) => (
            <ActivityRow key={e.id} entry={e} />
          ))}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? COPY.loadingOlder : COPY.loadOlder}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function ActivityRow({ entry }: { entry: AdminAuditEntry }) {
  return (
    <div className="adm-item">
      <div className="adm-item__row">
        <div className="adm-item__name">
          {ACTION_LABELS[entry.action] ?? entry.action}
        </div>
        <div className="adm-item__time">{formatUtc(entry.createdAt)}</div>
      </div>
      {entry.target !== "" && (
        <div className="adm-item__id">{entry.target}</div>
      )}
    </div>
  );
}
