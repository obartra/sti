import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { AvatarBuilder } from "./AvatarBuilder.tsx";
import { isAvatarConfig, type AvatarConfig } from "../../lib/avatars.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const cfg: AvatarConfig = { hair: 0, mood: 0, tone: 0 };

describe("AvatarBuilder", () => {
  it("picking a hair swatch reports just that field changed", async () => {
    const onChange = vi.fn();
    render(<AvatarBuilder config={cfg} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Spiky" }));
    expect(onChange).toHaveBeenCalledWith({ hair: 4, mood: 0, tone: 0 });
  });

  it("picking a mood and a tone changes only their fields", async () => {
    const onChange = vi.fn();
    render(<AvatarBuilder config={cfg} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Angry" }));
    expect(onChange).toHaveBeenCalledWith({ hair: 0, mood: 6, tone: 0 });
    await userEvent.click(screen.getByRole("button", { name: "Ink" }));
    expect(onChange).toHaveBeenCalledWith({ hair: 0, mood: 0, tone: 3 });
  });

  it("marks the selected option in each row as pressed", () => {
    render(
      <AvatarBuilder config={{ hair: 4, mood: 6, tone: 3 }} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Spiky" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Angry" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Plain" })).toHaveAttribute(
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
