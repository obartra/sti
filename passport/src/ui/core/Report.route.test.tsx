import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RouteControls } from "./Report.route.tsx";
import { COPY } from "./Report.parts.tsx";

// The two route toggles keep the label text outside the Switch for layout, so the
// association runs through htmlFor/id: the visible words must name the checkbox
// for assistive tech and toggle it when tapped.
describe("RouteControls", () => {
  function renderControls(over?: {
    onPrep?: (v: boolean) => void;
    onCondoms?: (v: boolean) => void;
  }) {
    render(
      <RouteControls
        prep={false}
        condoms={true}
        onPrep={over?.onPrep ?? (() => undefined)}
        onCondoms={over?.onCondoms ?? (() => undefined)}
      />,
    );
  }

  it("names each switch by its visible label", () => {
    renderControls();
    expect(screen.getByLabelText(COPY.prepLabel)).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: COPY.condomsLabel }),
    ).toBeChecked();
  });

  it("toggles when the label text itself is clicked", () => {
    const onPrep = vi.fn();
    const onCondoms = vi.fn();
    renderControls({ onPrep, onCondoms });

    screen.getByText(COPY.prepLabel).click();
    expect(onPrep).toHaveBeenCalledWith(true);

    screen.getByText(COPY.condomsLabel).click();
    expect(onCondoms).toHaveBeenCalledWith(false);
  });
});
