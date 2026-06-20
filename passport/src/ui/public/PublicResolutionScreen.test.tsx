import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PublicResolutionScreen } from "./PublicResolutionScreen.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import type { PassportStore } from "../../store/index.ts";

const LINK = { id: "A".repeat(43), key: "B".repeat(43) };

function storeResolving(
  to: ResolvedView | null,
  knock: PassportStore["knock"] = () => Promise.resolve(),
): PassportStore {
  return { resolveAlias: () => Promise.resolve(to), knock };
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
});
