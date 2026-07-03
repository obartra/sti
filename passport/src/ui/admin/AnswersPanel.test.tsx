import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AnswersPanel, buildAnswersCsv } from "./AnswersPanel.tsx";
import type { FeedbackOps } from "./FeedbackPanel.tsx";
import type {
  AdminActionResult,
  AdminFeedback,
  AdminFeedbackResult,
} from "./adminApi.ts";

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
  render(<AnswersPanel token="t" ops={ops} onUnauthorized={onUnauthorized} />);
  return { ops, onUnauthorized };
}

// A mixed queue: two labs answers on different questions plus a plain feedback
// report that must stay out of this view.
const MIXED: AdminFeedbackResult = {
  kind: "ok",
  feedback: [
    {
      id: 9,
      reason: "question",
      topic: "groups",
      body: "groups feel like mutual care to me",
      createdAt: Date.UTC(2026, 5, 25, 12, 0, 0),
    },
    {
      id: 8,
      reason: "question",
      topic: "help-or-harm",
      body: "it helped me have the conversation",
      createdAt: Date.UTC(2026, 5, 24, 12, 0, 0),
    },
    {
      id: 7,
      reason: "broken",
      body: "the share button does nothing",
      createdAt: Date.UTC(2026, 5, 23, 12, 0, 0),
    },
  ],
};

describe("AnswersPanel", () => {
  it("shows only question rows, grouped under their question's label", async () => {
    renderPanel({ list: () => Promise.resolve(MIXED) });
    expect(
      await screen.findByText("groups feel like mutual care to me"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("it helped me have the conversation"),
    ).toBeInTheDocument();
    // Each question's label appears twice: the count figure and the group head.
    expect(screen.getAllByText("5 · Groups")).toHaveLength(2);
    expect(screen.getAllByText("4 · Help or harm")).toHaveLength(2);
    // The plain feedback report belongs to the feedback queue, not here.
    expect(
      screen.queryByText("the share button does nothing"),
    ).not.toBeInTheDocument();
  });

  it("folds a missing topic into the general group", async () => {
    renderPanel({
      list: () =>
        Promise.resolve({
          kind: "ok",
          feedback: [
            { id: 1, reason: "question", body: "no topic", createdAt: 1 },
          ],
        } as AdminFeedbackResult),
    });
    expect(await screen.findByText("no topic")).toBeInTheDocument();
    expect(screen.getAllByText("In general").length).toBeGreaterThan(0);
  });

  it("resolves an answer and reloads", async () => {
    const user = userEvent.setup();
    const list = vi.fn(() => Promise.resolve(MIXED));
    const resolve = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ list, resolve });

    // Groups render in the doc's question order, so the first row is the
    // help-or-harm answer (question 4), id 8.
    const [first] = await screen.findAllByRole("button", { name: /resolve/i });
    if (!first) throw new Error("expected a resolve button");
    await user.click(first);
    expect(resolve).toHaveBeenCalledWith("t", 8);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2)); // initial + reload
  });

  it("shows an all-clear when nothing has come in", async () => {
    renderPanel();
    expect(await screen.findByText(/no answers yet/i)).toBeInTheDocument();
  });

  it("shows a load error and retries", async () => {
    const user = userEvent.setup();
    const list = vi
      .fn<FeedbackOps["list"]>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValueOnce(MIXED);
    renderPanel({ list });

    expect(
      await screen.findByText(/couldn't load answers/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(
      await screen.findByText("groups feel like mutual care to me"),
    ).toBeInTheDocument();
  });

  it("re-locks (onUnauthorized) when the token is rejected on load", async () => {
    const onUnauthorized = vi.fn();
    renderPanel(
      { list: () => Promise.resolve({ kind: "unauthorized" }) },
      onUnauthorized,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("offers the CSV download only when there are answers", async () => {
    renderPanel({ list: () => Promise.resolve(MIXED) });
    expect(
      await screen.findByRole("button", { name: /download csv/i }),
    ).toBeInTheDocument();
  });
});

describe("buildAnswersCsv", () => {
  it("emits a header plus one line per answer with UTC times", () => {
    const rows: AdminFeedback[] = [
      {
        id: 9,
        reason: "question",
        topic: "groups",
        body: "plain text",
        createdAt: Date.UTC(2026, 5, 25, 12, 30, 0),
      },
    ];
    expect(buildAnswersCsv(rows)).toBe(
      "id,topic,question,sent_at_utc,body\n" +
        "9,groups,5 · Groups,2026-06-25T12:30:00.000Z,plain text\n",
    );
  });

  it("quotes and escapes commas, quotes, and newlines per RFC 4180", () => {
    const rows: AdminFeedback[] = [
      {
        id: 1,
        reason: "question",
        topic: "language",
        body: 'first line, with a comma\nand a "quote"',
        createdAt: 0,
      },
    ];
    expect(buildAnswersCsv(rows)).toBe(
      "id,topic,question,sent_at_utc,body\n" +
        '1,language,3 · Language,1970-01-01T00:00:00.000Z,"first line, with a comma\nand a ""quote"""\n',
    );
  });

  it("folds an unknown topic into general", () => {
    const rows: AdminFeedback[] = [
      { id: 2, reason: "question", topic: "nonsense", body: "x", createdAt: 0 },
    ];
    expect(buildAnswersCsv(rows)).toContain("2,general,In general,");
  });
});
