import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { AvatarBuilder } from "./AvatarBuilder.tsx";
import { isAvatarConfig, type AvatarConfig } from "../../lib/avatars.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const cfg: AvatarConfig = { hair: 0, mood: 0, skin: 0, hairColor: 0, beard: 0 };

describe("AvatarBuilder", () => {
  it("picking a hair swatch reports just that field changed", async () => {
    const onChange = vi.fn();
    render(<AvatarBuilder config={cfg} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Hair: Spiky" }));
    expect(onChange).toHaveBeenCalledWith({ ...cfg, hair: 4 });
  });

  it("skin and hair color are independent fields (disambiguated by row)", async () => {
    const onChange = vi.fn();
    render(<AvatarBuilder config={cfg} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Skin: Teal" }));
    expect(onChange).toHaveBeenCalledWith({ ...cfg, skin: 3 });
    await userEvent.click(
      screen.getByRole("button", { name: "Hair color: Ink" }),
    );
    expect(onChange).toHaveBeenCalledWith({ ...cfg, hairColor: 5 });
  });

  it("offers a Bald hair option and a beard toggle", async () => {
    const onChange = vi.fn();
    render(<AvatarBuilder config={cfg} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Hair: Bald" }));
    expect(onChange).toHaveBeenCalledWith({ ...cfg, hair: 12 });
    await userEvent.click(screen.getByRole("button", { name: "Beard: Beard" }));
    expect(onChange).toHaveBeenCalledWith({ ...cfg, beard: 1 });
  });

  it("marks the selected option in each row as pressed", () => {
    render(
      <AvatarBuilder
        config={{ hair: 4, mood: 5, skin: 3, hairColor: 5, beard: 1 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Hair: Spiky" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Skin: Teal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Hair: Plain" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("'Surprise me' emits a valid random config", async () => {
    const onChange = vi.fn();
    render(<AvatarBuilder config={cfg} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Surprise me" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next: unknown = onChange.mock.calls[0]?.[0];
    expect(isAvatarConfig(next)).toBe(true);
  });
});
