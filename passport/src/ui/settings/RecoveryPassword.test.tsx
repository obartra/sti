import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  RecoveryPassword,
  type RecoveryPasswordOps,
} from "./RecoveryPassword.tsx";

const STRONG = "correct-horse-battery-staple";

function okOps(): RecoveryPasswordOps {
  return {
    set: vi.fn().mockResolvedValue("set"),
    disable: vi.fn().mockResolvedValue(undefined),
  };
}

describe("RecoveryPassword", () => {
  it("turns the password on with the normalized name, password, and phrase", async () => {
    const ops = okOps();
    render(<RecoveryPassword recoveryName={null} ops={ops} />);

    await userEvent.type(screen.getByLabelText("Recovery name"), "RobiN");
    await userEvent.type(screen.getByLabelText("New password"), STRONG);
    await userEvent.type(screen.getByLabelText("Confirm password"), STRONG);
    await userEvent.type(
      screen.getByLabelText("Recovery phrase"),
      "my-phrase-here",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Turn on password" }),
    );

    expect(ops.set).toHaveBeenCalledWith({
      name: "robin",
      password: STRONG,
      phrase: "my-phrase-here",
    });
  });

  it("blocks submit while the two passwords differ", async () => {
    const ops = okOps();
    render(<RecoveryPassword recoveryName={null} ops={ops} />);

    await userEvent.type(screen.getByLabelText("Recovery name"), "robin");
    await userEvent.type(screen.getByLabelText("New password"), STRONG);
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "different",
    );
    await userEvent.type(screen.getByLabelText("Recovery phrase"), "phrase");

    expect(screen.getByText("The passwords don't match.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Turn on password" }),
    ).toBeDisabled();
    expect(ops.set).not.toHaveBeenCalled();
  });

  it("shows the enabled view with the recovery name and turns it off", async () => {
    const ops = okOps();
    render(<RecoveryPassword recoveryName="robin" ops={ops} />);

    expect(screen.getByText("robin")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Turn off password" }),
    );
    expect(ops.disable).toHaveBeenCalledTimes(1);
  });

  it("surfaces a taken recovery name without leaving the form", async () => {
    const ops: RecoveryPasswordOps = {
      set: vi.fn().mockResolvedValue("nameUnavailable"),
      disable: vi.fn(),
    };
    render(<RecoveryPassword recoveryName={null} ops={ops} />);

    await userEvent.type(screen.getByLabelText("Recovery name"), "robin");
    await userEvent.type(screen.getByLabelText("New password"), STRONG);
    await userEvent.type(screen.getByLabelText("Confirm password"), STRONG);
    await userEvent.type(screen.getByLabelText("Recovery phrase"), "phrase");
    await userEvent.click(
      screen.getByRole("button", { name: "Turn on password" }),
    );

    expect(
      await screen.findByText("That recovery name is taken. Try another one."),
    ).toBeInTheDocument();
  });
});
