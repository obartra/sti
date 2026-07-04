import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// Root wraps App with the `/demo` deep-link (doc 28 G): the path both boots the demo
// and, via the router's `/demo` prefix, stays in the URL as a person moves around, so
// a reload keeps them in the demo and leaving does not strand the real app on it. Boot
// reads the URL at module load, so each case sets it, resets modules, and imports Root
// fresh. There is no legacy entry: `/demo` is the only route in.
const BANNER = "Demo. Nothing here is saved or sent.";

async function mountRoot(url: string) {
  window.history.replaceState(null, "", url);
  vi.resetModules();
  const { Root } = await import("./Root.tsx");
  return render(<Root />);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("Root demo deep-link", () => {
  it("boots straight into the demo when the URL is /demo", async () => {
    await mountRoot("/demo");
    expect((await screen.findAllByText(/@demo/)).length).toBeGreaterThan(0);
    expect(screen.getByText(BANNER)).toBeInTheDocument();
    // The clean path is kept as-is (no stray hash, no trailing slash).
    expect(window.location.pathname).toBe("/demo");
    expect(window.location.hash).toBe("");
  });

  it("stays on the real, logged-out app when the URL is not the demo", async () => {
    await mountRoot("/");
    expect(
      await screen.findByRole("button", { name: "Try the demo" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it("entering moves the URL to /demo so a reload stays in the demo", async () => {
    const user = userEvent.setup();
    await mountRoot("/");
    await user.click(
      await screen.findByRole("button", { name: "Try the demo" }),
    );
    expect(await screen.findByText(BANNER)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/demo");
  });

  it("leaving drops back to the real root so the app is not stranded on /demo", async () => {
    const user = userEvent.setup();
    await mountRoot("/demo");
    await screen.findByText(BANNER);
    await user.click(screen.getByRole("button", { name: "Leave demo" }));
    expect(
      await screen.findByRole("button", { name: "Try the demo" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
});
