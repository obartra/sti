import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PublicResolutionScreen } from "./PublicResolutionScreen.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import type { PassportStore } from "../../store/index.ts";

const LINK = { id: "A".repeat(43), key: "B".repeat(43) };

function storeResolving(to: ResolvedView | null): PassportStore {
  return { resolveAlias: () => Promise.resolve(to) };
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
});
