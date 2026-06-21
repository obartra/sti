import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PublicResolutionScreen } from "./PublicResolutionScreen.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import type { PassportStore } from "../../store/index.ts";

const LINK = { id: "A".repeat(43), key: "B".repeat(43) };

function storeResolving(
  to: ResolvedView | null,
  knock: PassportStore["knock"] = () => Promise.resolve(),
  redeemGrant: PassportStore["redeemGrant"] = () => Promise.resolve(null),
): PassportStore {
  return { resolveAlias: () => Promise.resolve(to), knock, redeemGrant };
}

describe("PublicResolutionScreen", () => {
  it("renders the resolved card once resolution completes", async () => {
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    render(<PublicResolutionScreen store={storeResolving(view)} link={LINK} />);

    expect(await screen.findByText("@robin")).toBeInTheDocument();
    expect(screen.getByText("Tested & on HIV prevention")).toBeInTheDocument();
  });

  it("renders the uniform gray-nothing when resolution returns null", async () => {
    render(<PublicResolutionScreen store={storeResolving(null)} link={LINK} />);

    expect(
      await screen.findByText("No status shared right now"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it("knocks on the alias id when the link-holder requests access", async () => {
    const user = userEvent.setup();
    const knock = vi.fn(() => Promise.resolve());
    render(
      <PublicResolutionScreen
        store={storeResolving(null, knock)}
        link={LINK}
      />,
    );

    // Gray-nothing + link-holder shows the knock prompt; requesting access sends
    // a knock for THIS alias id (and nothing identifying the requester).
    await user.click(
      await screen.findByRole("button", { name: "Request access" }),
    );
    expect(knock).toHaveBeenCalledWith(LINK.id);
  });

  it("resolves via an already-approved grant when the link key alone is gray", async () => {
    // The link has no usable key, but a knock from a prior visit was approved, so
    // the mount fallback redeems the grant and the card appears with no knock.
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    const store = storeResolving(
      null,
      () => Promise.resolve(),
      () => Promise.resolve(view),
    );
    render(<PublicResolutionScreen store={store} link={LINK} />);
    expect(await screen.findByText("@robin")).toBeInTheDocument();
  });

  it("polls for the grant after the viewer requests access", async () => {
    vi.useFakeTimers();
    try {
      const redeem = vi.fn(() => Promise.resolve(null));
      const store = storeResolving(null, () => Promise.resolve(), redeem);
      render(<PublicResolutionScreen store={store} link={LINK} />);
      // Flush the mount effect: resolveAlias -> null, then one redeem fallback.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const afterMount = redeem.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: "Request access" }));
      // The knock settles, which arms the poll.
      await act(async () => {
        await Promise.resolve();
      });
      // One poll interval elapses -> redeemGrant is called again.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(redeem.mock.calls.length).toBeGreaterThan(afterMount);
    } finally {
      vi.useRealTimers();
    }
  });
});
