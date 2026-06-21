import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { ShareHeadsUp } from "./Report.share.tsx";

describe("ShareHeadsUp", () => {
  it("defaults to the direct tone and switches message on a tone chip", async () => {
    const user = userEvent.setup();
    render(<ShareHeadsUp />);

    // Direct by default: the self-disclosing message.
    expect(
      screen.getByText(/I tested positive for an STI/i),
    ).toBeInTheDocument();

    // Switching to Gentle swaps to the no-self-disclosure wording.
    await user.click(screen.getByRole("button", { name: "Gentle" }));
    expect(screen.getByText(/looking out for you/i)).toBeInTheDocument();
    expect(screen.queryByText(/I tested positive for an STI/i)).toBeNull();
  });

  it("offers a copy control for the message", () => {
    render(<ShareHeadsUp />);
    expect(
      screen.getByRole("button", { name: "Copy message" }),
    ).toBeInTheDocument();
  });
});
