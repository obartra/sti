import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ErrorsPanel, type ErrorsOps } from "./ErrorsPanel.tsx";
import type { AdminErrors } from "./adminOpsApi.ts";

const DAY = Math.floor(Date.UTC(2026, 5, 25) / (24 * 60 * 60 * 1000));

const SAMPLE: AdminErrors = {
  days: [
    { day: DAY - 1, store: 0, enqueue: 0, janitor: 3, decode: 0 },
    { day: DAY, store: 1, enqueue: 0, janitor: 2, decode: 0 },
  ],
  totals: [
    { type: "store", count: 12 },
    { type: "enqueue", count: 0 },
    { type: "janitor", count: 173 },
    { type: "decode", count: 3 },
  ],
};

const ERROR_LINES = [
  { at: 3000, level: "ERROR", msg: "push send", attrs: "err=timeout" },
  { at: 2000, level: "ERROR", msg: "push send", attrs: "err=timeout" },
  { at: 1000, level: "ERROR", msg: "purge feedback", attrs: "err=disk" },
];

function renderPanel(over: Partial<ErrorsOps> = {}, onUnauthorized = vi.fn()) {
  const ops: ErrorsOps = {
    get: () => Promise.resolve({ kind: "ok", errors: SAMPLE }),
    errorLines: () => Promise.resolve({ kind: "ok", entries: ERROR_LINES }),
    clear: () => Promise.resolve("ok"),
    ...over,
  };
  render(<ErrorsPanel token="t" ops={ops} onUnauthorized={onUnauthorized} />);
  return { ops, onUnauthorized };
}

describe("ErrorsPanel", () => {
  it("shows today's count beside the lifetime total", async () => {
    renderPanel();
    // Today = 1 store + 2 janitor; lifetime = 12 + 173 + 3.
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText("188")).toBeInTheDocument();
  });

  it("rolls error lines up into distinct problems with counts and last-seen", async () => {
    renderPanel();
    expect(await screen.findByText("push send")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(screen.getByText("purge feedback")).toBeInTheDocument();
    expect(screen.getByText("1x")).toBeInTheDocument();
  });

  it("clears the totals after the deliberate second click and reloads", async () => {
    const user = userEvent.setup();
    const get = vi.fn(() =>
      Promise.resolve({ kind: "ok", errors: SAMPLE } as const),
    );
    const clear = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ get, clear });

    await user.click(
      await screen.findByRole("button", { name: /clear the totals/i }),
    );
    expect(clear).not.toHaveBeenCalled(); // first click only arms
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(clear).toHaveBeenCalledWith("t");
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2)); // initial + reload
  });

  it("shows a load error and retries", async () => {
    const user = userEvent.setup();
    const get = vi
      .fn<ErrorsOps["get"]>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValue({ kind: "ok", errors: SAMPLE });
    renderPanel({ get });

    expect(
      await screen.findByText(/couldn't load errors/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("188")).toBeInTheDocument();
  });

  it("re-locks (onUnauthorized) when the token is rejected", async () => {
    const onUnauthorized = vi.fn();
    renderPanel(
      { get: () => Promise.resolve({ kind: "unauthorized" }) },
      onUnauthorized,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});
