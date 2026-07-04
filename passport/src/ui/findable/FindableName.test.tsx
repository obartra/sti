import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PublicNames, type FindableOps } from "./FindableName.tsx";
import type { VanityRegisterResult } from "../../api/client.ts";

function ops(over: Partial<FindableOps> = {}): FindableOps {
  return {
    register: () => Promise.resolve("registered" as VanityRegisterResult),
    check: () => Promise.resolve("free" as const),
    release: () => Promise.resolve(),
    ...over,
  };
}

// Open the add flow (the claim form starts collapsed behind the "Add a public
// name" control, so claiming stays a deliberate step).
async function openAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add a public name/i }));
}

describe("PublicNames (the Links-tab manager)", () => {
  it("shows a calm empty state and the add control when none are held", () => {
    render(<PublicNames names={[]} ops={ops()} />);
    expect(screen.getByText(/no public names yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add a public name/i }),
    ).toBeEnabled();
    // No claim form until the owner opens it.
    expect(screen.queryByLabelText(/choose a name/i)).not.toBeInTheDocument();
  });

  it("claims a normalized name through the add flow", async () => {
    const user = userEvent.setup();
    const register = vi.fn(() => Promise.resolve("registered" as const));
    render(<PublicNames names={[]} ops={ops({ register })} />);

    await openAdd(user);
    await user.type(screen.getByLabelText(/choose a name/i), "RoBiN");
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );

    expect(register).toHaveBeenCalledWith("robin"); // normalized
    // On success the form closes (the list would grow via a fresh `names` prop).
    await waitFor(() =>
      expect(screen.queryByLabelText(/choose a name/i)).not.toBeInTheDocument(),
    );
  });

  it("checks availability as you type and shows a free name is free", async () => {
    const user = userEvent.setup();
    const check = vi.fn(() => Promise.resolve("free" as const));
    render(<PublicNames names={[]} ops={ops({ check })} />);
    await openAdd(user);
    await user.type(screen.getByLabelText(/choose a name/i), "robin");
    expect(await screen.findByText(/that name is free/i)).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith("robin");
  });

  it("flags a taken name as you type and blocks submit", async () => {
    const user = userEvent.setup();
    const register = vi.fn(() => Promise.resolve("registered" as const));
    render(
      <PublicNames
        names={[]}
        ops={ops({ register, check: () => Promise.resolve("taken") })}
      />,
    );
    await openAdd(user);
    await user.type(screen.getByLabelText(/choose a name/i), "robin");
    expect(await screen.findByText(/isn't available/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /make my name public/i }),
    ).toBeDisabled();
    expect(register).not.toHaveBeenCalled();
  });

  it("does not call the server for a format-invalid name as you type", async () => {
    const user = userEvent.setup();
    const check = vi.fn(() => Promise.resolve("free" as const));
    render(<PublicNames names={[]} ops={ops({ check })} />);
    await openAdd(user);
    await user.type(screen.getByLabelText(/choose a name/i), "ab"); // too short
    expect(
      await screen.findByText(/at least 3 characters/i),
    ).toBeInTheDocument();
    expect(check).not.toHaveBeenCalled();
  });

  it("shows an 'unavailable' message when the name can't be claimed", async () => {
    const user = userEvent.setup();
    render(
      <PublicNames
        names={[]}
        ops={ops({ register: () => Promise.resolve("unavailable") })}
      />,
    );
    await openAdd(user);
    await user.type(screen.getByLabelText(/choose a name/i), "robin");
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );
    expect(await screen.findByText(/isn't available/i)).toBeInTheDocument();
  });

  it("surfaces a transport error", async () => {
    const user = userEvent.setup();
    render(
      <PublicNames
        names={[]}
        ops={ops({ register: () => Promise.resolve("error") })}
      />,
    );
    await openAdd(user);
    await user.type(screen.getByLabelText(/choose a name/i), "robin");
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );
    expect(await screen.findByText(/couldn't reach/i)).toBeInTheDocument();
  });

  it("discloses the public-name consequences, with the findable cost visible up front", async () => {
    const user = userEvent.setup();
    render(<PublicNames names={[]} ops={ops()} />);
    await openAdd(user);
    // The findable cost is visible WITHOUT opening the expander (doc 17 launch gate:
    // the impact must not be buried), now stated as one line.
    expect(
      screen.getByText(
        /your name becomes public, so anyone can see you have a passport here/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your status itself stays private/i),
    ).toBeInTheDocument();
    // The lifecycle details live behind the expander.
    await user.click(screen.getByText(/what else this means/i));
    expect(screen.getByText(/anyone can claim it/i)).toBeInTheDocument();
    expect(screen.getByText(/aren't verified/i)).toBeInTheDocument();
  });

  it("lists each held name with its public link and removes one", async () => {
    const user = userEvent.setup();
    const release = vi.fn(() => Promise.resolve());
    render(<PublicNames names={["robin", "wren"]} ops={ops({ release })} />);

    // Both names + their public links show; no claim form while just listing.
    expect(screen.getByText("robin")).toBeInTheDocument();
    expect(screen.getByText("wren")).toBeInTheDocument();
    expect(screen.getByText("sti.care/u/robin")).toBeInTheDocument();
    expect(screen.getByText("sti.care/u/wren")).toBeInTheDocument();
    expect(screen.queryByLabelText(/choose a name/i)).not.toBeInTheDocument();

    // Removing a name releases exactly that one.
    const removes = screen.getAllByRole("button", { name: /^remove$/i });
    expect(removes).toHaveLength(2);
    const first = removes[0];
    if (!first) throw new Error("expected a remove control");
    await user.click(first);
    expect(release).toHaveBeenCalledWith("robin");
  });

  it("copies a name's public link", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<PublicNames names={["robin"]} ops={ops()} />);

    await user.click(screen.getByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith("https://sti.care/u/robin");
  });

  it("hides the remove control and explains why when a name is pinned", () => {
    render(<PublicNames names={["robin"]} ops={ops()} pinnedName="robin" />);
    expect(screen.getByText("robin")).toBeInTheDocument();
    // No remove control while the name is the sign-in username (doc 32).
    expect(
      screen.queryByRole("button", { name: /^remove$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/your sign-in username/i)).toBeInTheDocument();
  });

  it("surfaces the plain pin reason if the server refuses a remove (409)", async () => {
    const user = userEvent.setup();
    // A pin set in another tab after render: the remove is not gated here, but the
    // server refuses with a 409, surfaced by the api client as a "conflict".
    const conflict = Object.assign(new Error("vanity release"), {
      kind: "conflict" as const,
    });
    const release = vi.fn(() => Promise.reject(conflict));
    render(<PublicNames names={["robin"]} ops={ops({ release })} />);

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(
      await screen.findByText(/your sign-in username/i),
    ).toBeInTheDocument();
  });

  it("disables the add control at the maximum of 5 names", () => {
    render(
      <PublicNames
        names={["a_one", "a_two", "a_three", "a_four", "a_five"]}
        ops={ops()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /add a public name/i }),
    ).toBeDisabled();
    expect(screen.getByText(/maximum of 5/i)).toBeInTheDocument();
  });
});
