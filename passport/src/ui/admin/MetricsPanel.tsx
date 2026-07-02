import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Card } from "../../design/components/index.ts";
import type {
  AdminMetrics,
  AdminMetricsResult,
  AdminTrends,
  AdminTrendsResult,
} from "./adminApi.ts";

// The metrics panel (doc 20): a read-only dashboard of aggregate, identifier-free
// service telemetry. Number cards for the current totals (what the store holds), plus
// three trend charts below: reports filed per day, accounts created per day, and how
// long open reports have waited. Every figure is a count of opaque rows, a system size,
// or a time bucket, never a per-account or per-id value or a per-account creation time
// (doc 12), so it stays within the blind-store boundary. The live operational signals
// (send-queue backlog, errors, the background-loop heartbeat) live in the Service
// health panel, and the review/feedback backlog shows as a count on each queue panel,
// so nothing here is duplicated.
// The totals load first (one cheap query); the heavier trends are fetched separately
// so a slow or failed trends read never blanks the at-a-glance totals.

// The transport the panel needs, injected so tests and Storybook drive it without a
// server (and so AdminPage can bind it to its apiBase + token). `getTrends` is the
// separate, opt-in trends read; a totals-only render never waits on it.
export interface MetricsOps {
  get: (token: string) => Promise<AdminMetricsResult>;
  getTrends: (token: string) => Promise<AdminTrendsResult>;
}

const COPY = {
  title: "Service metrics",
  sub: "Aggregate, identifier-free totals. Counts of opaque rows, never facts about people.",
  loading: "Loading metrics…",
  loadError: "Couldn't load metrics. Check your connection and try again.",
  retry: "Retry",
  reportsTitle: "Reports filed per day",
  signupsTitle: "Accounts created per day",
  latencyTitle: "How long open reports have waited",
  trendsLoading: "Loading trends…",
  trendsError: "Couldn't load trends.",
} as const;

type Status = "loading" | "ready" | "loadError";

// Bytes to a short human size (B / KB / MB / GB), so the database-size card reads
// at a glance rather than as a raw byte count. Exported so the Manage panel renders
// a looked-up record's ciphertext size the same way.
export function humanBytes(n: number): string {
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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// An epoch-day (days since the Unix epoch, UTC) to a short "Jun 25" label for the
// per-day chart's x-axis. UTC so the bucket boundary matches the server's.
function dayLabel(epochDay: number): string {
  return new Date(epochDay * DAY_MS).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// A latency bucket's upper bound (ms) to a short "< 6h" / "< 3d" label. The 0 bound is
// the trailing overflow, shown as "older".
function latencyLabel(underMs: number): string {
  if (underMs === 0) return "older";
  if (underMs < DAY_MS) return `< ${Math.round(underMs / HOUR_MS)}h`;
  return `< ${Math.round(underMs / DAY_MS)}d`;
}

// A shared uppercase caption above each chart, so the trend charts read the same as
// the row chart's heading.
function ChartLabel({ text }: { text: string }) {
  return (
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
      {text}
    </div>
  );
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

// The stored-totals cards: what the store currently holds. The operational backlog
// (send queue) and the review/feedback queues are deliberately NOT here; they live in
// the Service health panel and as counts on their own queue panels, so a number is
// shown in exactly one place.
function StatGrid({ metrics }: { metrics: AdminMetrics }) {
  const cards: { label: string; value: string }[] = [
    { label: "Accounts", value: humanCount(metrics.accounts) },
    { label: "Live links", value: humanCount(metrics.aliases) },
    { label: "Live knocks", value: humanCount(metrics.knocks) },
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

// An area chart of one per-day count series over the recent window: reports filed, or
// accounts created. Daily counts of opaque rows, never a per-name/per-account series
// or a per-account creation time, so it stays identifier-free like the totals above.
// An empty window renders a bare axis. `unit` names the series in the tooltip.
function DailyAreaChart({
  title,
  series,
  unit,
}: {
  title: string;
  series: AdminTrends["reportsPerDay"];
  unit: string;
}) {
  const data = series.map((d) => ({ label: dayLabel(d.day), count: d.count }));
  return (
    <div>
      <ChartLabel text={title} />
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="label"
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
          <Tooltip formatter={(v) => [humanCount(Number(v ?? 0)), unit]} />
          <Area
            dataKey="count"
            stroke="var(--text-accent)"
            fill="var(--accent-soft)"
            strokeWidth={2}
            type="monotone"
            // Deterministic capture for the visual-regression baseline. Recharts drives
            // its enter animation with requestAnimationFrame (react-smooth), not CSS, so
            // lost-pixel's Playwright animations:'disabled' cannot freeze it and the
            // default 1500ms area animation outruns the capture's settle wait, drifting
            // the baseline run-to-run. Rendering the final curve synchronously fixes it.
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// A bar chart of the review-latency histogram: how many open reports have waited in
// each time band. A bucketed count of opaque rows, never a per-report wait keyed to a
// name or id, so it fingerprints no one.
function LatencyChart({ trends }: { trends: AdminTrends }) {
  const data = trends.reviewLatency.map((b) => ({
    label: latencyLabel(b.underMs),
    count: b.count,
  }));
  return (
    <div>
      <ChartLabel text={COPY.latencyTitle} />
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
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
            formatter={(v) => [humanCount(Number(v ?? 0)), "Reports"]}
          />
          <Bar
            dataKey="count"
            fill="var(--text-accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            // Synchronous final render, no animation frame race (see ReportsChart).
            isAnimationActive={false}
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
  refreshSignal = 0,
}: {
  token: string;
  ops: MetricsOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [trendStatus, setTrendStatus] = useState<Status>("loading");
  const [trends, setTrends] = useState<AdminTrends | null>(null);

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

  // Trends load separately from the totals: it is the heavier aggregation, so a slow
  // or failed read shows its own small notice below the totals rather than blanking
  // the whole panel. A 401 re-locks the page like any other admin call.
  const loadTrends = useCallback(() => {
    setTrendStatus("loading");
    void ops
      .getTrends(token)
      .then((r) => {
        if (r.kind === "ok") {
          setTrends(r.trends);
          setTrendStatus("ready");
        } else if (r.kind === "unauthorized") {
          onUnauthorized();
        } else {
          setTrendStatus("loadError");
        }
      })
      .catch(() => setTrendStatus("loadError"));
  }, [ops, token, onUnauthorized]);

  useEffect(() => {
    load();
    loadTrends();
  }, [load, loadTrends, refreshSignal]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            color: "var(--text-strong)",
          }}
        >
          {COPY.title}
        </h2>
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

      {status === "ready" && metrics !== null && <StatGrid metrics={metrics} />}

      {trendStatus === "loading" && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {COPY.trendsLoading}
        </div>
      )}

      {trendStatus === "loadError" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--status-expired-fg)" }}>
            {COPY.trendsError}
          </div>
          <Button variant="secondary" size="sm" onClick={loadTrends}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {trendStatus === "ready" && trends !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DailyAreaChart
            title={COPY.reportsTitle}
            series={trends.reportsPerDay}
            unit="Reports"
          />
          <DailyAreaChart
            title={COPY.signupsTitle}
            series={trends.signupsPerDay}
            unit="Accounts"
          />
          <LatencyChart trends={trends} />
        </div>
      )}
    </Card>
  );
}
