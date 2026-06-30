import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MetricsPanel, type MetricsOps } from "./MetricsPanel.tsx";
import type { AdminMetrics } from "./adminApi.ts";

const sample: AdminMetrics = {
  accounts: 1234,
  aliases: 5678,
  knocks: 9,
  sendQueueDepth: 2,
  dbSizeBytes: 5 * 1024 * 1024,
  pendingReports: 3,
};

function okOps(metrics: AdminMetrics): MetricsOps {
  return { get: () => Promise.resolve({ kind: "ok", metrics }) };
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

  it("re-locks the page when a call is unauthorized", async () => {
    const onUnauthorized = vi.fn();
    render(
      <MetricsPanel
        token="t"
        ops={{ get: () => Promise.resolve({ kind: "unauthorized" }) }}
        onUnauthorized={onUnauthorized}
      />,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it("shows an error with a working retry on a transport failure", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValue({ kind: "ok", metrics: sample });
    render(
      <MetricsPanel token="t" ops={{ get }} onUnauthorized={() => undefined} />,
    );
    const retry = await screen.findByRole("button", { name: "Retry" });
    await userEvent.click(retry);
    // After the retry succeeds the totals render in place of the error.
    expect(await screen.findByText("1,234")).toBeInTheDocument();
  });
});
