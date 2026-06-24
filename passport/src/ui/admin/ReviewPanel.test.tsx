import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReviewPanel, type ReviewOps } from "./ReviewPanel.tsx";
import type { AdminActionResult, AdminReportsResult } from "./adminApi.ts";

function renderPanel(over: Partial<ReviewOps> = {}, onUnauthorized = vi.fn()) {
  const ops: ReviewOps = {
    list: () =>
      Promise.resolve({ kind: "ok", reports: [] } as AdminReportsResult),
    act: () => Promise.resolve("ok" as AdminActionResult),
    ...over,
  };
  render(<ReviewPanel token="t" ops={ops} onUnauthorized={onUnauthorized} />);
  return { ops, onUnauthorized };
}

const oneReport = (over = {}): AdminReportsResult => ({
  kind: "ok",
  reports: [
    { name: "rob1n", reason: "impersonation", count: 3, createdAt: 1, ...over },
  ],
});

const exact = (s: string) => (_: string, el: Element | null) =>
  el?.textContent === s;

describe("ReviewPanel", () => {
  it("lists a report with its count + human reason label", async () => {
    renderPanel({ list: () => Promise.resolve(oneReport()) });
    expect(await screen.findByText("rob1n")).toBeInTheDocument();
    // The count and the code-to-label mapping render in one line.
    expect(
      screen.getByText(exact("3 reports · Impersonation")),
    ).toBeInTheDocument();
  });

  it("takes a name down and reloads the queue", async () => {
    const user = userEvent.setup();
    const list = vi.fn(() => Promise.resolve(oneReport()));
    const act = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ list, act });

    await user.click(await screen.findByRole("button", { name: /take down/i }));
    expect(act).toHaveBeenCalledWith("t", "rob1n", "takedown");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2)); // initial + reload
  });

  it("dismisses a report", async () => {
    const user = userEvent.setup();
    const act = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ list: () => Promise.resolve(oneReport()), act });

    await user.click(await screen.findByRole("button", { name: /dismiss/i }));
    expect(act).toHaveBeenCalledWith("t", "rob1n", "dismiss");
  });

  it("shows an all-clear when the queue is empty", async () => {
    renderPanel();
    expect(await screen.findByText(/no open reports/i)).toBeInTheDocument();
  });

  it("shows a load error and retries", async () => {
    const user = userEvent.setup();
    const list = vi
      .fn<ReviewOps["list"]>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValueOnce(oneReport());
    renderPanel({ list });

    expect(
      await screen.findByText(/couldn't load reports/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("rob1n")).toBeInTheDocument();
  });

  it("re-locks (onUnauthorized) when the token is rejected on load", async () => {
    const onUnauthorized = vi.fn();
    renderPanel(
      { list: () => Promise.resolve({ kind: "unauthorized" }) },
      onUnauthorized,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("re-locks (onUnauthorized) when an action is rejected with 401", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      {
        list: () => Promise.resolve(oneReport()),
        act: () => Promise.resolve("unauthorized"),
      },
      onUnauthorized,
    );
    await user.click(await screen.findByRole("button", { name: /take down/i }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows a plain notice (no re-lock) when an action transport-errors", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      {
        list: () => Promise.resolve(oneReport()),
        act: () => Promise.resolve("error"),
      },
      onUnauthorized,
    );
    await user.click(await screen.findByRole("button", { name: /dismiss/i }));
    expect(await screen.findByText(/didn't go through/i)).toBeInTheDocument();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
