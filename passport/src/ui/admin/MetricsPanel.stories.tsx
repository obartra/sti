import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { MetricsPanel, type MetricsOps } from "./MetricsPanel.tsx";
import type { AdminMetrics, AdminTrends } from "./adminApi.ts";

// The metrics panel (doc 20): aggregate, identifier-free totals plus two trend charts
// (reports filed per day, and how long open reports have waited). The stories stub the
// transport so each state renders without a server. Everything shown is a count of
// opaque rows, a system size, or a time bucket, never a per-account or per-id figure.
const meta: Meta<typeof MetricsPanel> = {
  title: "Passport/Admin/MetricsPanel",
  component: MetricsPanel,
  args: { token: "demo-token", onUnauthorized: () => undefined },
};
export default meta;
type Story = StoryObj<typeof MetricsPanel>;

const SAMPLE_METRICS: AdminMetrics = {
  accounts: 1840,
  aliases: 5210,
  knocks: 37,
  sendQueueDepth: 4,
  dbSizeBytes: 18 * 1024 * 1024,
  pendingReports: 2,
  pendingFeedback: 1,
};

// A week of per-day report counts (epoch-days, UTC) and a latency histogram, so the
// trend charts have deterministic baseline content.
const DAY_MS = 24 * 60 * 60 * 1000;
const baseDay = Math.floor(Date.UTC(2026, 5, 25) / DAY_MS);
const SAMPLE_TRENDS: AdminTrends = {
  reportsPerDay: [0, 2, 1, 4, 3, 5, 2].map((count, i) => ({
    day: baseDay - 6 + i,
    count,
  })),
  reviewLatency: [
    { underMs: 60 * 60 * 1000, count: 3 },
    { underMs: 6 * 60 * 60 * 1000, count: 5 },
    { underMs: DAY_MS, count: 2 },
    { underMs: 3 * DAY_MS, count: 1 },
    { underMs: 7 * DAY_MS, count: 0 },
    { underMs: 0, count: 0 },
  ],
};

const opsFor = (metrics: AdminMetrics, trends: AdminTrends): MetricsOps => ({
  get: () => Promise.resolve({ kind: "ok", metrics }),
  getTrends: () => Promise.resolve({ kind: "ok", trends }),
});

// The populated dashboard: totals, the row chart, and both trend charts.
export const Populated: Story = {
  args: { ops: opsFor(SAMPLE_METRICS, SAMPLE_TRENDS) },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        within(canvasElement).getByText("Reports filed per day"),
      ).toBeInTheDocument(),
    );
  },
};

// The all-clear: zero totals and empty trend series (a bare axis, no bars).
export const Empty: Story = {
  args: {
    ops: opsFor(
      {
        accounts: 0,
        aliases: 0,
        knocks: 0,
        sendQueueDepth: 0,
        dbSizeBytes: 0,
        pendingReports: 0,
        pendingFeedback: 0,
      },
      { reportsPerDay: [], reviewLatency: [] },
    ),
  },
};
