import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FindableResolve } from "./FindableResolve.tsx";

const ID = "A".repeat(43);

describe("FindableResolve", () => {
  it("resolves a name to its alias id and hands off to the knock flow", async () => {
    const onResolved = vi.fn();
    render(
      <FindableResolve
        name="robin"
        resolve={() => Promise.resolve(ID)}
        onResolved={onResolved}
      />,
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(ID));
    // It never falls to the not-found state on a hit.
    expect(
      screen.queryByText(/no passport at that name/i),
    ).not.toBeInTheDocument();
  });

  it("shows a not-found state with a claim CTA when the name is unregistered", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    const onClaim = vi.fn();
    render(
      <FindableResolve
        name="nobody"
        resolve={() => Promise.resolve(null)}
        onResolved={onResolved}
        onClaim={onClaim}
      />,
    );
    expect(
      await screen.findByText(/no passport at that name/i),
    ).toBeInTheDocument();
    expect(onResolved).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: /get your own private passport/i }),
    );
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it("shows the looking-up state (with the name) while resolving", () => {
    render(
      <FindableResolve
        name="robin"
        resolve={() => new Promise<string | null>(() => undefined)}
        onResolved={vi.fn()}
      />,
    );
    expect(screen.getByText(/looking up/i)).toBeInTheDocument();
    expect(screen.getByText("robin")).toBeInTheDocument();
  });

  it("does not re-resolve when the callbacks change identity (only on name change)", async () => {
    const resolve = vi.fn(() => Promise.resolve(ID));
    const { rerender } = render(
      <FindableResolve name="robin" resolve={resolve} onResolved={vi.fn()} />,
    );
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    // Fresh closures (as the screen renderer passes each render) must NOT re-fire
    // the lookup — only a changed `name` does.
    const resolve2 = vi.fn(() => Promise.resolve("B".repeat(43)));
    rerender(
      <FindableResolve name="robin" resolve={resolve2} onResolved={vi.fn()} />,
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve2).not.toHaveBeenCalled();
  });
});
