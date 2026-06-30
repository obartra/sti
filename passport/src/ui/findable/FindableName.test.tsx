import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FindableName, type FindableOps } from "./FindableName.tsx";
import type { VanityRegisterResult } from "../../api/client.ts";

function ops(over: Partial<FindableOps> = {}): FindableOps {
  return {
    register: () => Promise.resolve("registered" as VanityRegisterResult),
    release: () => Promise.resolve(),
    ...over,
  };
}

describe("FindableName", () => {
  it("claims a normalized name and reports it up", async () => {
    const user = userEvent.setup();
    const register = vi.fn(() => Promise.resolve("registered" as const));
    const onChange = vi.fn();
    render(
      <FindableName
        currentName={null}
        ops={ops({ register })}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText(/choose a name/i), "RoBiN");
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );

    expect(register).toHaveBeenCalledWith("robin"); // normalized
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("robin"));
  });

  it("rejects an invalid name locally without calling the server", async () => {
    const user = userEvent.setup();
    const register = vi.fn(() => Promise.resolve("registered" as const));
    render(<FindableName currentName={null} ops={ops({ register })} />);

    await user.type(screen.getByLabelText(/choose a name/i), "ab"); // too short
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );

    expect(
      await screen.findByText(/at least 3 characters/i),
    ).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("does not block abuse names locally: it asks the server, which is authoritative (G8)", async () => {
    // The client no longer ships a scam/abuse blocklist; a name like "scam" passes the
    // instant check and reaches the server, which answers blocked names with a 409
    // surfaced as "unavailable". So the client must NOT short-circuit it.
    const user = userEvent.setup();
    const register = vi.fn(() => Promise.resolve("unavailable" as const));
    render(<FindableName currentName={null} ops={ops({ register })} />);

    await user.type(screen.getByLabelText(/choose a name/i), "scam");
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );

    expect(register).toHaveBeenCalledWith("scam");
    expect(await screen.findByText(/isn't available/i)).toBeInTheDocument();
  });

  it("shows an 'unavailable' message when the name can't be claimed", async () => {
    const user = userEvent.setup();
    render(
      <FindableName
        currentName={null}
        ops={ops({ register: () => Promise.resolve("unavailable") })}
      />,
    );
    await user.type(screen.getByLabelText(/choose a name/i), "robin");
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );
    expect(await screen.findByText(/isn't available/i)).toBeInTheDocument();
  });

  it("surfaces a transport error", async () => {
    const user = userEvent.setup();
    render(
      <FindableName
        currentName={null}
        ops={ops({ register: () => Promise.resolve("error") })}
      />,
    );
    await user.type(screen.getByLabelText(/choose a name/i), "robin");
    await user.click(
      screen.getByRole("button", { name: /make my name public/i }),
    );
    expect(await screen.findByText(/couldn't reach/i)).toBeInTheDocument();
  });

  it("discloses the public-name consequences, with the findable cost visible up front", async () => {
    const user = userEvent.setup();
    render(<FindableName currentName={null} ops={ops()} />);
    // The headline + the findable cost are visible WITHOUT opening anything
    // (doc 17 launch gate: the impact must not be buried).
    expect(
      screen.getByText(/becomes public and searchable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/anyone can see you have a passport here/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your status itself stays private/i),
    ).toBeInTheDocument();
    // The lifecycle details live behind the expander.
    await user.click(screen.getByText(/what else this means/i));
    expect(screen.getByText(/anyone can claim it/i)).toBeInTheDocument();
    expect(screen.getByText(/aren't verified/i)).toBeInTheDocument();
  });

  it("shows the registered name and releases it", async () => {
    const user = userEvent.setup();
    const release = vi.fn(() => Promise.resolve());
    const onChange = vi.fn();
    render(
      <FindableName
        currentName="robin"
        ops={ops({ release })}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("robin")).toBeInTheDocument();
    // The register form is not shown while a name is held.
    expect(screen.queryByLabelText(/choose a name/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /release name/i }));
    expect(release).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });
});
