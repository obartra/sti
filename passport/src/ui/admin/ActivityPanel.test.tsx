import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ActivityPanel, type AuditOps } from "./ActivityPanel.tsx";
import type { AdminAuditEntry, AdminAuditResult } from "./adminApi.ts";

const ok = (entries: AdminAuditEntry[]): AdminAuditResult => ({
  kind: "ok",
  entries,
});

// A fixed UTC instant so the formatted label is deterministic across timezones.
const T = Date.UTC(2026, 5, 25, 14, 30, 0);
const T_LABEL = "2026-06-25 14:30 UTC";

describe("ActivityPanel", () => {
  it("renders recent actions with human labels, target, and a UTC time", async () => {
    // 2026-06-25T14:30:00Z = T
    const ops: AuditOps = {
      list: () =>
        Promise.resolve(
          ok([
            { action: "vanity.takedown", target: "rob1n", createdAt: T },
            { action: "account.disable", target: "acct-123", createdAt: T },
          ]),
        ),
    };
    render(
      <ActivityPanel token="t" ops={ops} onUnauthorized={() => undefined} />,
    );

    expect(await screen.findByText("Name taken down")).toBeInTheDocument();
    expect(screen.getByText("rob1n")).toBeInTheDocument();
    expect(screen.getByText("Account disabled")).toBeInTheDocument();
    // Absolute UTC, deterministic across timezones.
    expect(screen.getAllByText(T_LABEL)).toHaveLength(2);
  });

  it("falls back to the raw verb for an unknown action and hides an empty target", async () => {
    const ops: AuditOps = {
      list: () =>
        Promise.resolve(
          ok([{ action: "future.thing", target: "", createdAt: T }]),
        ),
    };
    render(
      <ActivityPanel token="t" ops={ops} onUnauthorized={() => undefined} />,
    );
    // No label mapping, so the raw verb shows; the empty target renders nothing.
    expect(await screen.findByText("future.thing")).toBeInTheDocument();
    expect(screen.getByText(T_LABEL)).toBeInTheDocument();
  });

  it("shows the empty state when there are no actions", async () => {
    const ops: AuditOps = { list: () => Promise.resolve(ok([])) };
    render(
      <ActivityPanel token="t" ops={ops} onUnauthorized={() => undefined} />,
    );
    expect(
      await screen.findByText(/no admin actions recorded yet/i),
    ).toBeInTheDocument();
  });

  it("surfaces a load error and retries", async () => {
    const user = userEvent.setup();
    const list = vi
      .fn<AuditOps["list"]>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValueOnce(
        ok([{ action: "ping", target: "", createdAt: T }]),
      );
    render(
      <ActivityPanel
        token="t"
        ops={{ list }}
        onUnauthorized={() => undefined}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Session opened")).toBeInTheDocument();
  });

  it("bubbles a 401 up so the page can re-lock", async () => {
    const onUnauthorized = vi.fn();
    const ops: AuditOps = {
      list: () => Promise.resolve({ kind: "unauthorized" }),
    };
    render(
      <ActivityPanel token="t" ops={ops} onUnauthorized={onUnauthorized} />,
    );
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it("refreshes on demand", async () => {
    const user = userEvent.setup();
    const list = vi
      .fn<AuditOps["list"]>()
      .mockResolvedValue(ok([{ action: "ping", target: "", createdAt: T }]));
    render(
      <ActivityPanel
        token="t"
        ops={{ list }}
        onUnauthorized={() => undefined}
      />,
    );
    await screen.findByText("Session opened");
    await user.click(screen.getByRole("button", { name: /refresh/i }));
    expect(list).toHaveBeenCalledTimes(2);
  });
});
