import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// Root wraps App with the `/#demo` deep-link (doc 28 G): the hash both boots the
// demo and stays in sync as a person enters and leaves, so a reload keeps them in
// the demo and leaving does not strand the real app on the demo route. Boot reads
// the hash at module load, so each case sets the hash, resets modules, and imports
// Root fresh.
async function mountRoot(hash: string) {
  window.history.replaceState(null, "", "/" + hash);
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
  it("boots straight into the demo when the URL is /#demo", async () => {
    await mountRoot("#demo");
    expect((await screen.findAllByText(/@demo/)).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Demo. Nothing here is saved or sent."),
    ).toBeInTheDocument();
  });

  it("stays on the real, logged-out app when there is no #demo hash", async () => {
    await mountRoot("");
    expect(
      await screen.findByRole("button", { name: "Try the demo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Demo. Nothing here is saved or sent."),
    ).toBeNull();
  });

  it("entering syncs the URL to #demo so a reload stays in the demo", async () => {
    const user = userEvent.setup();
    await mountRoot("");
    await user.click(
      await screen.findByRole("button", { name: "Try the demo" }),
    );
    expect(
      await screen.findByText("Demo. Nothing here is saved or sent."),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#demo");
  });

  it("leaving clears the #demo hash so the real app is not stranded on it", async () => {
    const user = userEvent.setup();
    await mountRoot("#demo");
    await screen.findByText("Demo. Nothing here is saved or sent.");
    await user.click(screen.getByRole("button", { name: "Leave demo" }));
    expect(
      await screen.findByRole("button", { name: "Try the demo" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});
