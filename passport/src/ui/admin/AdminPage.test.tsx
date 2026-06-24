import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";
import { AdminPage } from "./AdminPage.tsx";
import type { AdminPingResult } from "./adminApi.ts";
import type { ReviewOps } from "./ReviewPanel.tsx";

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

function renderPage(
  ping: (token: string) => Promise<AdminPingResult>,
  reviewOps: ReviewOps = emptyOps,
) {
  return render(
    <AdminPage
      apiBase="https://api.example"
      ping={ping}
      reviewOps={reviewOps}
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
