import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";
import { AdminPage } from "./AdminPage.tsx";
import type { AdminPingResult } from "./adminApi.ts";
import type { ReviewOps } from "./ReviewPanel.tsx";
import type { AuditOps } from "./ActivityPanel.tsx";
import type { MetricsOps } from "./MetricsPanel.tsx";
import type { HealthOps } from "./HealthPanel.tsx";
import type { FeedbackOps } from "./FeedbackPanel.tsx";
import type { ManageOps } from "./ManagePanel.tsx";
import type { LogsOps } from "./LogsPanel.tsx";
import type { RestartOps } from "./RestartPanel.tsx";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

const STORAGE_KEY = "sti.admin.token";

// A panel transport stub so the authed shell renders without a real server (the
// panel loads on mount). The review panel itself has dedicated tests.
const emptyOps: ReviewOps = {
  list: () => Promise.resolve({ kind: "ok", reports: [] }),
  act: () => Promise.resolve("ok"),
};

// The activity panel also loads on mount; stub it so the authed shell stays
// server-free. The panel has its own dedicated tests.
const emptyAudit: AuditOps = {
  list: () => Promise.resolve({ kind: "ok", entries: [] }),
};

// The metrics panel loads on mount too; stub it for the same reason. Its own tests
// cover the rendering.
const emptyMetrics: MetricsOps = {
  get: () =>
    Promise.resolve({
      kind: "ok",
      metrics: {
        accounts: 0,
        aliases: 0,
        knocks: 0,
        sendQueueDepth: 0,
        dbSizeBytes: 0,
        pendingReports: 0,
        pendingFeedback: 0,
      },
    }),
  getTrends: () =>
    Promise.resolve({
      kind: "ok",
      trends: { reportsPerDay: [], signupsPerDay: [], reviewLatency: [] },
    }),
};

// The health panel loads on mount too; stub it so the authed shell stays
// server-free. The panel has its own dedicated tests.
const emptyHealth: HealthOps = {
  get: () =>
    Promise.resolve({
      kind: "ok",
      health: {
        errors: [],
        sendQueueDepth: 0,
        sendQueueOldestAgeSeconds: 0,
        janitorAgeSeconds: -1,
        inflightCurrent: 0,
        inflightMax: 0,
      },
    }),
};

// The feedback panel also loads on mount; stub it so the authed shell stays
// server-free. The panel has its own dedicated tests.
const emptyFeedback: FeedbackOps = {
  list: () => Promise.resolve({ kind: "ok", feedback: [] }),
  resolve: () => Promise.resolve("ok"),
};

// The manage panel is idle until an operator looks up an id, so its transport is
// never called on mount; stub it anyway so the authed shell stays server-free. The
// panel has its own dedicated tests.
const emptyManage: ManageOps = {
  lookup: () =>
    Promise.resolve({
      kind: "ok",
      record: {
        alias: { exists: false, sizeBytes: 0, updatedAt: 0 },
        account: { exists: false, sizeBytes: 0, updatedAt: 0 },
        inbox: { exists: false, sizeBytes: 0, updatedAt: 0 },
      },
    }),
  disable: () => Promise.resolve("ok"),
  revoke: () => Promise.resolve("ok"),
};

// The logs panel loads on mount when the Tools tab shows; stub it so the authed
// shell stays server-free. The panel has its own dedicated tests.
const emptyLogs: LogsOps = {
  list: () => Promise.resolve({ kind: "ok", entries: [] }),
};

// The restart control only acts on a deliberate double click; stub it anyway so
// the authed shell stays server-free. The panel has its own dedicated tests.
const idleRestart: RestartOps = {
  restart: () => Promise.resolve("ok"),
  ping: () => Promise.resolve("ok"),
};

function renderPage(
  ping: (token: string) => Promise<AdminPingResult>,
  reviewOps: ReviewOps = emptyOps,
) {
  return render(
    <AdminPage
      apiBase="https://api.example"
      ping={ping}
      reviewOps={reviewOps}
      auditOps={emptyAudit}
      metricsOps={emptyMetrics}
      healthOps={emptyHealth}
      feedbackOps={emptyFeedback}
      manageOps={emptyManage}
      logsOps={emptyLogs}
      restartOps={idleRestart}
    />,
  );
}

describe("AdminPage", () => {
  it("unlocks with a valid token and persists it to sessionStorage", async () => {
    const user = userEvent.setup();
    const ping = vi.fn(() => Promise.resolve("ok" as const));
    renderPage(ping);

    await user.type(screen.getByLabelText(/operator token/i), "good-token");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(
      await screen.findByText(/operator session active/i),
    ).toBeInTheDocument();
    expect(ping).toHaveBeenCalledWith("good-token");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("good-token");
  });

  it("rejects a wrong token, shows an error, and stores nothing", async () => {
    const user = userEvent.setup();
    renderPage(() => Promise.resolve("unauthorized" as const));

    await user.type(screen.getByLabelText(/operator token/i), "nope");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText(/was not accepted/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/operator session active/i),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("surfaces a transport error distinctly from a wrong token", async () => {
    const user = userEvent.setup();
    renderPage(() => Promise.resolve("error" as const));

    await user.type(screen.getByLabelText(/operator token/i), "whatever");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText(/couldn't reach/i)).toBeInTheDocument();
  });

  it("does not call ping for an empty/whitespace token", async () => {
    const user = userEvent.setup();
    const ping = vi.fn(() => Promise.resolve("ok" as const));
    renderPage(ping);

    // The button is disabled while empty; typing only spaces keeps it inert.
    await user.type(screen.getByLabelText(/operator token/i), "   ");
    expect(screen.getByRole("button", { name: /unlock/i })).toBeDisabled();
    expect(ping).not.toHaveBeenCalled();
  });

  it("auto-validates a stored token on mount and shows the panel", async () => {
    sessionStorage.setItem(STORAGE_KEY, "stored-token");
    const ping = vi.fn(() => Promise.resolve("ok" as const));
    renderPage(ping);

    expect(
      await screen.findByText(/operator session active/i),
    ).toBeInTheDocument();
    expect(ping).toHaveBeenCalledWith("stored-token");
  });

  it("clears an invalid stored token on mount and shows the gate", async () => {
    sessionStorage.setItem(STORAGE_KEY, "stale-token");
    renderPage(() => Promise.resolve("unauthorized" as const));

    expect(await screen.findByLabelText(/operator token/i)).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it("keeps a stored token on a transport error during mount validation", async () => {
    sessionStorage.setItem(STORAGE_KEY, "still-good");
    renderPage(() => Promise.resolve("error" as const));

    // The gate is shown with the unreachable notice, but the token is NOT wiped: a
    // transient blip on reload must not force the operator to re-enter the secret.
    expect(await screen.findByText(/couldn't reach/i)).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("still-good");
  });

  it("recovers (does not get stuck) if the validator rejects on mount", async () => {
    sessionStorage.setItem(STORAGE_KEY, "tok");
    renderPage(() => Promise.reject(new Error("boom")));

    // A rejecting validator maps to the transport branch: the gate returns, the
    // token is preserved, and the page never stays on the checking spinner.
    expect(await screen.findByText(/couldn't reach/i)).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("tok");
  });

  it("opens on the overview and reaches every panel through the tabs", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(STORAGE_KEY, "stored-token");
    renderPage(() => Promise.resolve("ok" as const));

    // The default tab is the overview: the health band plus the backlog strip.
    expect(
      await screen.findByText(/operator session active/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/service health/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting for review/i)).toBeInTheDocument();
    // The queue panels themselves live behind the Queues tab (the overview's
    // backlog strip shares the "Reported names" words, so key off the heading).
    expect(
      screen.queryByRole("heading", { name: /reported names/i }),
    ).not.toBeInTheDocument();

    // Queues: both work queues plus the labs answers view.
    await user.click(screen.getByRole("tab", { name: /queues/i }));
    expect(
      await screen.findByRole("heading", { name: /reported names/i }),
    ).toBeInTheDocument();
    // The Feedback panel, keyed off its unique sub (its bare title collides with a
    // metrics stat card of the same name).
    expect(screen.getByText(/something wrong\?/i)).toBeInTheDocument();
    expect(screen.getByText(/open-questions page/i)).toBeInTheDocument();

    // Metrics, then Tools (the id lookup beside the audit record).
    await user.click(screen.getByRole("tab", { name: /metrics/i }));
    expect(await screen.findByText(/service metrics/i)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /tools/i }));
    expect(await screen.findByText(/manage records/i)).toBeInTheDocument();
    expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    expect(screen.getByText(/server log/i)).toBeInTheDocument();
    expect(screen.getByText(/restart the service/i)).toBeInTheDocument();
  });

  it("locks again, clearing the stored token", async () => {
    const user = userEvent.setup();
    renderPage(() => Promise.resolve("ok" as const));

    await user.type(screen.getByLabelText(/operator token/i), "good");
    await user.click(screen.getByRole("button", { name: /unlock/i }));
    expect(
      await screen.findByText(/operator session active/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^lock$/i }));
    expect(await screen.findByLabelText(/operator token/i)).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
