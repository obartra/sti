import { render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { App } from "./App.tsx";
import type { ResolvedView } from "./public/PublicResolution.tsx";
import type { PassportStore } from "../store/index.ts";

// End-to-end of the UI wiring: a real shared link in the URL routes through
// parseAliasLink -> useAppRouter -> Chrome -> the a2-public screen ->
// store.resolveAlias -> render. The store is stubbed so the assertion is on the
// wiring, not the network (the real round-trip is covered by the integration
// tests).
const ID = "A".repeat(43);
const KEY = "B".repeat(43);

function stubStore(to: ResolvedView | null): PassportStore {
  return { resolveAlias: () => Promise.resolve(to) };
}

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("App routing of a shared passport link", () => {
  it("resolves and renders the card for /a/{id}#k={key}", async () => {
    window.history.pushState({}, "", `/a/${ID}#k=${KEY}`);
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    render(<App store={stubStore(view)} />);

    expect(await screen.findByText("@robin")).toBeInTheDocument();
  });

  it("renders the uniform gray-nothing when the link does not resolve", async () => {
    window.history.pushState({}, "", `/a/${ID}#k=${KEY}`);
    render(<App store={stubStore(null)} />);

    expect(
      await screen.findByText("No status shared right now"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^@/)).toBeNull();
  });
});
