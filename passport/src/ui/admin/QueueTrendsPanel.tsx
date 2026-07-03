import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import { DailyAreaChart, BucketBarChart } from "./adminCharts.tsx";
import "./admin.css";
import type { AdminTrends } from "./adminApi.ts";
import type { MetricsOps } from "./MetricsPanel.tsx";

// The queue-trends panel (doc 20): the two charts that describe the review
// queue itself, kept beside the queues they measure. Reports filed per day is
// the inflow; the wait histogram is the accountability read (how long the open
// ones have sat). Aggregate only: daily counts and time buckets of opaque rows,
// never a per-name or per-account figure.

const COPY = {
  title: "Queue trends",
  sub: "How reports flow in, and how long the open ones have waited.",
  loading: "Loading trends…",
  loadError: "Couldn't load trends. Check your connection and try again.",
  retry: "Retry",
  reportsTitle: "Reports filed per day",
  latencyTitle: "How long open reports have waited",
} as const;

type Status = "loading" | "ready" | "loadError";

export function QueueTrendsPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  // The same transport as Usage; this panel only reads the trends slice.
  ops: MetricsOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [trends, setTrends] = useState<AdminTrends | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    void ops
      .getTrends(token)
      .then((r) => {
        if (r.kind === "ok") {
          setTrends(r.trends);
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

      {status === "ready" && trends !== null && (
        <div className="adm-charts adm-charts--pair">
          <DailyAreaChart
            title={COPY.reportsTitle}
            series={trends.reportsPerDay}
            unit="Reports"
          />
          <BucketBarChart
            title={COPY.latencyTitle}
            buckets={trends.reviewLatency}
            unit="Reports"
          />
        </div>
      )}
    </section>
  );
}
