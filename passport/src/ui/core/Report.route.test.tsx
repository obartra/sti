import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RouteControls } from "./Report.route.tsx";
import { COPY } from "./Report.parts.tsx";

// The two route toggles keep the label text outside the Switch for layout, so the
// association runs through htmlFor/id: the visible words must name the checkbox
// for assistive tech and toggle it when tapped.
describe("RouteControls", () => {
  it("names each switch by its visible label", () => {
    render(
      <RouteControls
        prep={false}
        condoms={true}
        onPrep={() => undefined}
        onCondoms={() => undefined}
      />,
    );
    expect(screen.getByLabelText(COPY.prepLabel)).not.toBeChecked();
    expect(screen.getByLabelText(COPY.condomsLabel)).toBeChecked();
  });

  it("toggles when the label text itself is clicked", () => {
    const onPrep = vi.fn();
    const onCondoms = vi.fn();
    render(
      <RouteControls
        prep={false}
        condoms={true}
        onPrep={onPrep}
        onCondoms={onCondoms}
      />,
    );

    screen.getByText(COPY.prepLabel).click();
    expect(onPrep).toHaveBeenCalledWith(true);

    screen.getByText(COPY.condomsLabel).click();
    expect(onCondoms).toHaveBeenCalledWith(false);
  });
});
