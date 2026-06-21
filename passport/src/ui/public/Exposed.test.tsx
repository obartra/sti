import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Exposed } from "./Exposed.tsx";
import { RESOURCES } from "../../lib/resources.ts";

afterEach(() => vi.restoreAllMocks());

describe("Exposed", () => {
  it("opens the CDC test finder when finding testing", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<Exposed />);

    await user.click(
      screen.getByRole("button", { name: /Find free testing near you/i }),
    );
    expect(open).toHaveBeenCalledWith(
      RESOURCES.clinic,
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("offers PEP and PrEP next steps and a soft passport CTA", async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    render(<Exposed onClaim={onClaim} />);

    expect(screen.getByText(/under 72 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/PrEP for prevention/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Get your own private passport/i }),
    );
    expect(onClaim).toHaveBeenCalledTimes(1);
  });
});
