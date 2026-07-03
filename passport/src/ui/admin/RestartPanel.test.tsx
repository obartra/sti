import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RestartPanel, type RestartOps } from "./RestartPanel.tsx";
import type { AdminActionResult, AdminPingResult } from "./adminApi.ts";

function renderPanel(
  over: Partial<RestartOps> = {},
  extra: { onUnauthorized?: () => void; onRestarted?: () => void } = {},
) {
  const ops: RestartOps = {
    restart: () => Promise.resolve("ok" as AdminActionResult),
    ping: () => Promise.resolve("ok" as AdminPingResult),
    ...over,
  };
  const onUnauthorized = extra.onUnauthorized ?? vi.fn();
  render(
    <RestartPanel
      token="t"
      ops={ops}
      onUnauthorized={onUnauthorized}
      onRestarted={extra.onRestarted}
      pollMs={5}
    />,
  );
  return { ops, onUnauthorized };
}

// The control is a deliberate two-click: arm, then confirm.
async function confirmRestart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^restart$/i }));
  await user.click(screen.getByRole("button", { name: /confirm/i }));
}

describe("RestartPanel", () => {
  it("requires the second confirming click before acting", async () => {
    const user = userEvent.setup();
    const restart = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ restart });

    await user.click(screen.getByRole("button", { name: /^restart$/i }));
    expect(restart).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
  });

  it("restarts, probes until the service answers, then reports back up", async () => {
    const user = userEvent.setup();
    // Down for the first two probes (transport error), then back.
    const ping = vi
      .fn<RestartOps["ping"]>()
      .mockResolvedValueOnce("error")
      .mockResolvedValueOnce("error")
      .mockResolvedValue("ok");
    const onRestarted = vi.fn();
    renderPanel({ ping }, { onRestarted });

    await confirmRestart(user);
    expect(await screen.findByText(/restarting/i)).toBeInTheDocument();
    expect(await screen.findByText(/back up/i)).toBeInTheDocument();
    expect(ping.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(onRestarted).toHaveBeenCalledTimes(1);
  });

  it("shows a plain notice when the restart call itself fails", async () => {
    const user = userEvent.setup();
    renderPanel({ restart: () => Promise.resolve("error") });
    await confirmRestart(user);
    expect(await screen.findByText(/didn't go through/i)).toBeInTheDocument();
  });

  it("re-locks when the restart call is rejected with 401", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      { restart: () => Promise.resolve("unauthorized") },
      { onUnauthorized },
    );
    await confirmRestart(user);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("gives up with an honest notice when the service never comes back", async () => {
    const user = userEvent.setup();
    renderPanel({ ping: () => Promise.resolve("error") });
    await confirmRestart(user);
    expect(
      await screen.findByText(/still not back/i, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
