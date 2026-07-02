import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HealthPanel, healthStatus, type HealthOps } from "./HealthPanel.tsx";
import type { AdminHealth } from "./adminApi.ts";

const CLEAR: AdminHealth = {
  errors: [
    { type: "store", count: 0 },
    { type: "enqueue", count: 0 },
    { type: "janitor", count: 0 },
    { type: "decode", count: 0 },
  ],
  sendQueueDepth: 0,
  sendQueueOldestAgeSeconds: 0,
  janitorAgeSeconds: 8,
  inflightCurrent: 0,
  inflightMax: 64,
};

const WARN: AdminHealth = {
  ...CLEAR,
  errors: [
    { type: "store", count: 2 },
    { type: "enqueue", count: 0 },
    { type: "janitor", count: 0 },
    { type: "decode", count: 1 },
  ],
  sendQueueDepth: 3,
  sendQueueOldestAgeSeconds: 42,
};

function okOps(health: AdminHealth): HealthOps {
  return { get: () => Promise.resolve({ kind: "ok", health }) };
}

describe("healthStatus", () => {
  it("is all-clear when nothing is logged, the queue is empty, and the loop is fresh", () => {
    expect(healthStatus(CLEAR)).toEqual({ tone: "ok", label: "All clear" });
  });

  it("needs a look when any internal error is logged", () => {
    expect(healthStatus(WARN).tone).toBe("warn");
  });

  it("needs a look when the send queue is stuck draining", () => {
    expect(
      healthStatus({ ...CLEAR, sendQueueOldestAgeSeconds: 600 }).tone,
    ).toBe("warn");
  });

  it("needs a look when the background loop has gone stale", () => {
    expect(healthStatus({ ...CLEAR, janitorAgeSeconds: 1200 }).tone).toBe(
      "warn",
    );
  });

  it("does not flag a never-run loop (age -1) as stale on a fresh boot", () => {
    expect(healthStatus({ ...CLEAR, janitorAgeSeconds: -1 }).tone).toBe("ok");
  });

  it("is unknown for a missing snapshot", () => {
    expect(healthStatus(null).tone).toBe("unknown");
  });
});

describe("HealthPanel", () => {
  it("renders the all-clear chip and the tiles once loaded", async () => {
    render(
      <HealthPanel
        token="t"
        ops={okOps(CLEAR)}
        onUnauthorized={() => undefined}
      />,
    );
    expect(await screen.findByText("All clear")).toBeInTheDocument();
    // The heartbeat age renders as a short relative label, not a raw second count.
    expect(screen.getByText("8s")).toBeInTheDocument();
    // An all-zero box shows a plain "none since start", never four zeros.
    expect(screen.getByText(/none since start/i)).toBeInTheDocument();
  });

  it("shows the amber chip and the per-subsystem error breakdown when logged", async () => {
    render(
      <HealthPanel
        token="t"
        ops={okOps(WARN)}
        onUnauthorized={() => undefined}
      />,
    );
    expect(await screen.findByText("Needs a look")).toBeInTheDocument();
    // Only the nonzero subsystems appear, under friendly labels.
    expect(screen.getByText(/Storage 2/)).toBeInTheDocument();
    expect(screen.getByText(/Decode 1/)).toBeInTheDocument();
  });

  it("shows 'no tick yet' when the background loop has never run", async () => {
    render(
      <HealthPanel
        token="t"
        ops={okOps({ ...CLEAR, janitorAgeSeconds: -1 })}
        onUnauthorized={() => undefined}
      />,
    );
    expect(await screen.findByText(/no tick yet/i)).toBeInTheDocument();
  });

  it("re-locks the page when the call is unauthorized", async () => {
    const onUnauthorized = vi.fn();
    render(
      <HealthPanel
        token="t"
        ops={{ get: () => Promise.resolve({ kind: "unauthorized" }) }}
        onUnauthorized={onUnauthorized}
      />,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows an error with a working retry on a transport failure", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValue({ kind: "ok", health: CLEAR });
    render(
      <HealthPanel token="t" ops={{ get }} onUnauthorized={() => undefined} />,
    );
    const retry = await screen.findByRole("button", { name: "Retry" });
    await userEvent.click(retry);
    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });
});
