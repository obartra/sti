import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Card } from "../../design/components/index.ts";
import type { AdminMetrics, AdminMetricsResult } from "./adminApi.ts";

// The A5 metrics panel (doc 20): a read-only dashboard of aggregate, identifier-free
// service totals. Number cards for the current counts, plus a bar chart of the row
// counts. Every figure is a count of opaque rows or a system size, never a
// per-account or per-id value (doc 12), so it stays within the blind-store boundary.
// Per-day trend lines come once the server exposes the time series.

// The transport the panel needs, injected so tests and Storybook drive it without a
// server (and so AdminPage can bind it to its apiBase + token).
export interface MetricsOps {
  get: (token: string) => Promise<AdminMetricsResult>;
}

const COPY = {
  title: "Service metrics",
  sub: "Aggregate, identifier-free totals. Counts of opaque rows, never facts about people.",
  loading: "Loading metrics…",
  loadError: "Couldn't load metrics. Check your connection and try again.",
  retry: "Retry",
  chartTitle: "Stored rows",
} as const;

type Status = "loading" | "ready" | "loadError";

// Bytes to a short human size (B / KB / MB / GB), so the database-size card reads
// at a glance rather than as a raw byte count.
function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

// A compact integer (1,234) so big totals stay readable on the number cards.
function humanCount(n: number): string {
  return n.toLocaleString("en-US");
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "var(--text-strong)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        {label}
      </div>
    </Card>
  );
}

function StatGrid({ metrics }: { metrics: AdminMetrics }) {
  const cards: { label: string; value: string }[] = [
    { label: "Accounts", value: humanCount(metrics.accounts) },
    { label: "Live links", value: humanCount(metrics.aliases) },
    { label: "Live knocks", value: humanCount(metrics.knocks) },
    { label: "Review queue", value: humanCount(metrics.pendingReports) },
    { label: "Feedback", value: humanCount(metrics.pendingFeedback) },
    { label: "Send queue", value: humanCount(metrics.sendQueueDepth) },
    { label: "Database", value: humanBytes(metrics.dbSizeBytes) },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 10,
      }}
    >
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} />
      ))}
    </div>
  );
}

// A bar chart of the row counts the store holds. Counts only (opaque rows), never a
// per-account distribution, so it stays identifier-free like the cards above.
function RowChart({ metrics }: { metrics: AdminMetrics }) {
  const data = [
    { name: "Accounts", count: metrics.accounts },
    { name: "Links", count: metrics.aliases },
    { name: "Knocks", count: metrics.knocks },
    { name: "Reports", count: metrics.pendingReports },
  ];
  return (
    <div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          marginBottom: 8,
        }}
      >
        {COPY.chartTitle}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--accent-soft)" }}
            formatter={(v) => [humanCount(Number(v ?? 0)), "Rows"]}
          />
          <Bar
            dataKey="count"
            fill="var(--text-accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricsPanel({
  token,
  ops,
  onUnauthorized,
}: {
  token: string;
  ops: MetricsOps;
  onUnauthorized: () => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
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
  }, [load]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div
          style={{ fontSize: 15, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {COPY.sub}
        </div>
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

      {status === "ready" && metrics !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StatGrid metrics={metrics} />
          <RowChart metrics={metrics} />
        </div>
      )}
    </Card>
  );
}
