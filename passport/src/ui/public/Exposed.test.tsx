import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Exposed } from "./Exposed.tsx";
import { RESOURCES } from "../../lib/resources.ts";
import { infoUrl } from "../../lib/info.ts";

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

  it("opens the info site's testing guide from the what-to-expect row", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<Exposed />);

    await user.click(
      screen.getByRole("button", { name: /Getting tested, what to expect/i }),
    );
    expect(open).toHaveBeenCalledWith(
      infoUrl("/testing"),
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
      screen.getByRole("button", { name: /create your own passport/i }),
    );
    expect(onClaim).toHaveBeenCalledTimes(1);
  });
});
