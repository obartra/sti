import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FeedbackPanel, type FeedbackOps } from "./FeedbackPanel.tsx";
import type { AdminActionResult, AdminFeedbackResult } from "./adminApi.ts";

function renderPanel(
  over: Partial<FeedbackOps> = {},
  onUnauthorized = vi.fn(),
) {
  const ops: FeedbackOps = {
    list: () =>
      Promise.resolve({ kind: "ok", feedback: [] } as AdminFeedbackResult),
    resolve: () => Promise.resolve("ok" as AdminActionResult),
    ...over,
  };
  render(<FeedbackPanel token="t" ops={ops} onUnauthorized={onUnauthorized} />);
  return { ops, onUnauthorized };
}

const oneReport = (over = {}): AdminFeedbackResult => ({
  kind: "ok",
  feedback: [
    {
      id: 7,
      reason: "broken",
      body: "the share button does nothing",
      createdAt: 1,
      ...over,
    },
  ],
});

describe("FeedbackPanel", () => {
  it("lists a report with its category label and the note", async () => {
    renderPanel({ list: () => Promise.resolve(oneReport()) });
    expect(await screen.findByText("Something's broken")).toBeInTheDocument();
    expect(
      screen.getByText("the share button does nothing"),
    ).toBeInTheDocument();
  });

  it("shows a placeholder when the note is empty", async () => {
    renderPanel({ list: () => Promise.resolve(oneReport({ body: "" })) });
    expect(await screen.findByText(/no note/i)).toBeInTheDocument();
  });

  it("resolves a report and reloads the queue", async () => {
    const user = userEvent.setup();
    const list = vi.fn(() => Promise.resolve(oneReport()));
    const resolve = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ list, resolve });

    await user.click(await screen.findByRole("button", { name: /resolve/i }));
    expect(resolve).toHaveBeenCalledWith("t", 7);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2)); // initial + reload
  });

  it("leaves question responses to the answers view", async () => {
    renderPanel({
      list: () =>
        Promise.resolve({
          kind: "ok",
          feedback: [
            {
              id: 9,
              reason: "question",
              topic: "groups",
              body: "a labs answer",
              createdAt: 2,
            },
            {
              id: 7,
              reason: "broken",
              body: "the share button does nothing",
              createdAt: 1,
            },
          ],
        } as AdminFeedbackResult),
    });
    expect(await screen.findByText("Something's broken")).toBeInTheDocument();
    expect(screen.queryByText("a labs answer")).not.toBeInTheDocument();
  });

  it("shows an all-clear when the queue is empty", async () => {
    renderPanel();
    expect(await screen.findByText(/no open reports/i)).toBeInTheDocument();
  });

  it("shows a load error and retries", async () => {
    const user = userEvent.setup();
    const list = vi
      .fn<FeedbackOps["list"]>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValueOnce(oneReport());
    renderPanel({ list });

    expect(
      await screen.findByText(/couldn't load reports/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Something's broken")).toBeInTheDocument();
  });

  it("re-locks (onUnauthorized) when the token is rejected on load", async () => {
    const onUnauthorized = vi.fn();
    renderPanel(
      { list: () => Promise.resolve({ kind: "unauthorized" }) },
      onUnauthorized,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("re-locks (onUnauthorized) when resolve is rejected with 401", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      {
        list: () => Promise.resolve(oneReport()),
        resolve: () => Promise.resolve("unauthorized"),
      },
      onUnauthorized,
    );
    await user.click(await screen.findByRole("button", { name: /resolve/i }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows a plain notice (no re-lock) when resolve transport-errors", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      {
        list: () => Promise.resolve(oneReport()),
        resolve: () => Promise.resolve("error"),
      },
      onUnauthorized,
    );
    await user.click(await screen.findByRole("button", { name: /resolve/i }));
    expect(await screen.findByText(/didn't go through/i)).toBeInTheDocument();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
