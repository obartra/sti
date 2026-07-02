import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Care } from "./Care.tsx";

describe("Care PEP finder", () => {
  it("offers a time-sensitive PEP row that opens the PEP resource", async () => {
    const user = userEvent.setup();
    const onFindPep = vi.fn();
    render(<Care onFindPep={onFindPep} />);

    const pep = screen.getByText("PEP, if it has been under 72 hours");
    expect(
      screen.getByText("Emergency HIV prevention, time-sensitive"),
    ).toBeInTheDocument();
    await user.click(pep);
    expect(onFindPep).toHaveBeenCalledOnce();
  });

  it("offers the testing guide row in learn and talk", async () => {
    const user = userEvent.setup();
    const onLearnTesting = vi.fn();
    render(<Care onLearnTesting={onLearnTesting} />);

    await user.click(screen.getByText("Getting tested, what to expect"));
    expect(onLearnTesting).toHaveBeenCalledOnce();
  });

  it("leads the resource finders with PEP (most time-critical first)", () => {
    render(<Care />);
    const pep = screen.getByText("PEP, if it has been under 72 hours");
    const condoms = screen.getByText("Find free condoms near you");
    const prep = screen.getByText("Find free or low-cost PrEP near you");

    // PEP precedes both PrEP (ongoing prevention) and the condom finder, since a
    // just-exposed viewer needs it within the 72h window.
    expect(pep.compareDocumentPosition(condoms)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(pep.compareDocumentPosition(prep)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
