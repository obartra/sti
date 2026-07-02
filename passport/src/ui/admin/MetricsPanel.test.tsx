import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MetricsPanel, type MetricsOps } from "./MetricsPanel.tsx";
import type { AdminMetrics, AdminTrends } from "./adminApi.ts";

const sample: AdminMetrics = {
  accounts: 1234,
  aliases: 5678,
  knocks: 9,
  sendQueueDepth: 2,
  dbSizeBytes: 5 * 1024 * 1024,
  pendingReports: 3,
  pendingFeedback: 1,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const sampleTrends: AdminTrends = {
  reportsPerDay: [
    { day: Math.floor(Date.UTC(2026, 5, 24) / DAY_MS), count: 2 },
    { day: Math.floor(Date.UTC(2026, 5, 25) / DAY_MS), count: 5 },
  ],
  signupsPerDay: [
    { day: Math.floor(Date.UTC(2026, 5, 24) / DAY_MS), count: 6 },
    { day: Math.floor(Date.UTC(2026, 5, 25) / DAY_MS), count: 9 },
  ],
  reviewLatency: [
    { underMs: 60 * 60 * 1000, count: 1 },
    { underMs: 6 * 60 * 60 * 1000, count: 2 },
    { underMs: 0, count: 0 },
  ],
};

function okOps(
  metrics: AdminMetrics,
  trends: AdminTrends = sampleTrends,
): MetricsOps {
  return {
    get: () => Promise.resolve({ kind: "ok", metrics }),
    getTrends: () => Promise.resolve({ kind: "ok", trends }),
  };
}

describe("MetricsPanel", () => {
  it("renders the totals as number cards once loaded", async () => {
    render(
      <MetricsPanel
        token="t"
        ops={okOps(sample)}
        onUnauthorized={() => undefined}
      />,
    );
    // Counts are humanized (thousands separators) and the database size is bytes ->
    // a short human size.
    expect(await screen.findByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("5,678")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Live links")).toBeInTheDocument();
  });

  it("renders the trend charts from the trends data", async () => {
    render(
      <MetricsPanel
        token="t"
        ops={okOps(sample)}
        onUnauthorized={() => undefined}
      />,
    );
    // The two trend chart headings render once the (separate) trends read resolves.
    expect(
      await screen.findByText("Reports filed per day"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("How long open reports have waited"),
    ).toBeInTheDocument();
    // Aggregate-only: nothing per-account or per-id is ever rendered. No id-shaped or
    // "account #N" label leaks into the panel.
    expect(screen.queryByText(/account #/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/per account/i)).not.toBeInTheDocument();
  });

  it("re-locks the page when a call is unauthorized", async () => {
    const onUnauthorized = vi.fn();
    render(
      <MetricsPanel
        token="t"
        ops={{
          get: () => Promise.resolve({ kind: "unauthorized" }),
          getTrends: () => Promise.resolve({ kind: "unauthorized" }),
        }}
        onUnauthorized={onUnauthorized}
      />,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows an error with a working retry on a transport failure", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValue({ kind: "ok", metrics: sample });
    render(
      <MetricsPanel
        token="t"
        ops={{
          get,
          getTrends: () =>
            Promise.resolve({ kind: "ok", trends: sampleTrends }),
        }}
        onUnauthorized={() => undefined}
      />,
    );
    const retry = await screen.findByRole("button", { name: "Retry" });
    await userEvent.click(retry);
    // After the retry succeeds the totals render in place of the error.
    expect(await screen.findByText("1,234")).toBeInTheDocument();
  });

  it("shows a trends error with a working retry independent of the totals", async () => {
    const getTrends = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValue({ kind: "ok", trends: sampleTrends });
    render(
      <MetricsPanel
        token="t"
        ops={{
          get: () => Promise.resolve({ kind: "ok", metrics: sample }),
          getTrends,
        }}
        onUnauthorized={() => undefined}
      />,
    );
    // The totals still render even though the trends read failed.
    expect(await screen.findByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load trends.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByText("Reports filed per day"),
    ).toBeInTheDocument();
  });
});
