import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LogsPanel, type LogsOps } from "./LogsPanel.tsx";
import type { AdminLogsResult } from "./adminOpsApi.ts";

function renderPanel(over: Partial<LogsOps> = {}, onUnauthorized = vi.fn()) {
  const ops: LogsOps = {
    list: () => Promise.resolve({ kind: "ok", entries: [] } as AdminLogsResult),
    ...over,
  };
  render(<LogsPanel token="t" ops={ops} onUnauthorized={onUnauthorized} />);
  return { ops, onUnauthorized };
}

const someLines = (): AdminLogsResult => ({
  kind: "ok",
  entries: [
    {
      at: Date.UTC(2026, 5, 25, 18, 45, 12),
      level: "ERROR",
      msg: "push send",
      attrs: "err=context deadline exceeded",
    },
    {
      at: Date.UTC(2026, 5, 25, 18, 44, 0),
      level: "INFO",
      msg: "purged expired knocks",
      attrs: "count=3",
    },
  ],
});

describe("LogsPanel", () => {
  it("lists lines with level, message, and rendered attrs", async () => {
    renderPanel({ list: () => Promise.resolve(someLines()) });
    expect(
      await screen.findByText(/push send err=context deadline exceeded/),
    ).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(
      screen.getByText(/purged expired knocks count=3/),
    ).toBeInTheDocument();
  });

  it("shows the fresh-boot empty state", async () => {
    renderPanel();
    expect(
      await screen.findByText(/nothing logged since the last restart/i),
    ).toBeInTheDocument();
  });

  it("shows a load error and retries", async () => {
    const user = userEvent.setup();
    const list = vi
      .fn<LogsOps["list"]>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValueOnce(someLines());
    renderPanel({ list });

    expect(
      await screen.findByText(/couldn't load the log/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText(/push send/)).toBeInTheDocument();
  });

  it("re-locks (onUnauthorized) when the token is rejected", async () => {
    const onUnauthorized = vi.fn();
    renderPanel(
      { list: () => Promise.resolve({ kind: "unauthorized" }) },
      onUnauthorized,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});
