import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import { DailyAreaChart, BucketBarChart } from "./adminCharts.tsx";
import "./admin.css";
import type {
  AdminMetrics,
  AdminMetricsResult,
  AdminTrends,
  AdminTrendsResult,
} from "./adminApi.ts";
import type { AdminPerf, AdminPerfResult } from "./adminOpsApi.ts";

// The Usage panel (doc 20): growth and capacity. Number cards for the current
// totals (what the store holds), then three trend charts: accounts created per
// day, requests served per day, and how fast requests finish. Every figure is a
// count of opaque rows or events, a system size, or a time bucket, never a
// per-account or per-id value (doc 12), so it stays within the blind-store
// boundary. The queue-shaped charts (reports filed, review latency) live with
// the queues; the live operational signals live on the Overview.
// The totals load first (one cheap query); the heavier series are fetched
// separately so a slow or failed read never blanks the at-a-glance totals.

// The transport the panel needs, injected so tests and Storybook drive it
// without a server. `getTrends` carries the accounts-per-day series; `getPerf`
// the request series; both are separate, opt-in reads behind the totals.
export interface MetricsOps {
  get: (token: string) => Promise<AdminMetricsResult>;
  getTrends: (token: string) => Promise<AdminTrendsResult>;
  getPerf: (token: string) => Promise<AdminPerfResult>;
}

const COPY = {
  title: "Usage",
  sub: "Aggregate, identifier-free totals and trends. Counts of opaque rows, never facts about people.",
  loading: "Loading totals…",
  loadError: "Couldn't load totals. Check your connection and try again.",
  retry: "Retry",
  signupsTitle: "Accounts created per day",
  requestsTitle: "Requests served per day",
  latencyTitle: "How fast requests finish",
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

// One stored-totals figure: a serif number over an eyebrow label, no box.
function StatFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="adm-figure">
      <div className="adm-figure__value">{value}</div>
      <div className="adm-figure__label">{label}</div>
    </div>
  );
}

// The stored-totals figures: what the store currently holds. The operational
// backlog and the review/feedback queues are deliberately NOT here; they live on
// the Overview and as counts on their own queue panels, so a number is shown in
// exactly one place.
function StatGrid({ metrics }: { metrics: AdminMetrics }) {
  const cards: { label: string; value: string }[] = [
    { label: "Accounts", value: humanCount(metrics.accounts) },
    { label: "Live links", value: humanCount(metrics.aliases) },
    { label: "Live knocks", value: humanCount(metrics.knocks) },
    { label: "Database", value: humanBytes(metrics.dbSizeBytes) },
  ];
  return (
    <div className="adm-figures">
      {cards.map((c) => (
        <StatFigure key={c.label} label={c.label} value={c.value} />
      ))}
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
  const [perf, setPerf] = useState<AdminPerf | null>(null);

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

  // The series load separately from the totals: they are the heavier reads, so
  // a slow or failed fetch shows its own small notice below the totals rather
  // than blanking the whole panel. A 401 re-locks the page like any admin call.
  const loadSeries = useCallback(() => {
    setTrendStatus("loading");
    void Promise.all([ops.getTrends(token), ops.getPerf(token)])
      .then(([t, p]) => {
        if (t.kind === "unauthorized" || p.kind === "unauthorized") {
          onUnauthorized();
          return;
        }
        if (t.kind !== "ok" || p.kind !== "ok") {
          setTrendStatus("loadError");
          return;
        }
        setTrends(t.trends);
        setPerf(p.perf);
        setTrendStatus("ready");
      })
      .catch(() => setTrendStatus("loadError"));
  }, [ops, token, onUnauthorized]);

  useEffect(() => {
    load();
    loadSeries();
  }, [load, loadSeries, refreshSignal]);

  return (
    <section className="adm-panel">
      <PanelHeading title={COPY.title} sub={COPY.sub} />

      {status === "loading" && <div className="adm-note">{COPY.loading}</div>}

      {status === "loadError" && (
        <div className="adm-retry">
          <div className="adm-error">{COPY.loadError}</div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {status === "ready" && metrics !== null && <StatGrid metrics={metrics} />}

      {trendStatus === "loading" && (
        <div className="adm-note">{COPY.trendsLoading}</div>
      )}

      {trendStatus === "loadError" && (
        <div className="adm-retry">
          <div className="adm-error">{COPY.trendsError}</div>
          <Button variant="secondary" size="sm" onClick={loadSeries}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {trendStatus === "ready" && trends !== null && perf !== null && (
        <div className="adm-charts">
          <DailyAreaChart
            title={COPY.signupsTitle}
            series={trends.signupsPerDay}
            unit="Accounts"
          />
          <DailyAreaChart
            title={COPY.requestsTitle}
            series={perf.requestsPerDay}
            unit="Requests"
          />
          <BucketBarChart
            title={COPY.latencyTitle}
            buckets={perf.latency}
            unit="Requests"
            overflowLabel="slower"
          />
        </div>
      )}
    </section>
  );
}
