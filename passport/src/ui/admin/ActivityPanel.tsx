import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
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
// timezone, and absolute time is what an operator audit wants.
function formatUtc(ms: number): string {
  const iso = new Date(ms).toISOString(); // 2026-06-25T14:30:00.000Z
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

type Status = "loading" | "ready" | "loadError";

export function ActivityPanel({
  token,
  ops,
  onUnauthorized,
}: {
  token: string;
  ops: AuditOps;
  onUnauthorized: () => void;
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
  }, [load]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {COPY.title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {COPY.sub}
          </div>
        </div>
        {status === "ready" && (
          <Button variant="ghost" size="sm" onClick={load}>
            {COPY.refresh}
          </Button>
        )}
      </div>

      {status === "loading" && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {COPY.loading}
        </div>
      )}

      {status === "loadError" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--status-expired-fg)" }}>
            {COPY.loadError}
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {status === "ready" && entries.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {COPY.empty}
        </div>
      )}

      {status === "ready" && entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
    </Card>
  );
}

function ActivityRow({ entry }: { entry: AdminAuditEntry }) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div
          style={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {ACTION_LABELS[entry.action] ?? entry.action}
        </div>
        <div
          style={{ fontSize: 11.5, color: "var(--text-subtle)", flex: "none" }}
        >
          {formatUtc(entry.createdAt)}
        </div>
      </div>
      {entry.target !== "" && (
        <div
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: 12.5,
            color: "var(--text-muted)",
            wordBreak: "break-all",
          }}
        >
          {entry.target}
        </div>
      )}
    </Card>
  );
}
