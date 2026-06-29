import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CreateFlow } from "./ClaimCreateFlow.tsx";
import { isAvatarConfig } from "../../lib/avatars.ts";

describe("create-account flow (doc 19)", () => {
  it("does not build the avatar inline (assigned randomly, customized later)", () => {
    render(<CreateFlow />);
    // The avatar builder is gone from signup; no Surprise me or color rows here.
    expect(
      screen.queryByRole("button", { name: "Surprise me" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Skin")).not.toBeInTheDocument();
    // The flow still collects the display name.
    expect(
      screen.getByPlaceholderText("Pick a display name"),
    ).toBeInTheDocument();
  });

  it("passes a valid (random) avatar to onClaim", async () => {
    const onClaim =
      vi.fn<(handle: string | undefined, avatar: unknown) => void>();
    render(<CreateFlow onClaim={onClaim} />);
    await userEvent.type(
      screen.getByPlaceholderText("Pick a display name"),
      "robin",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create|continue|claim/i }),
    );
    expect(onClaim).toHaveBeenCalledTimes(1);
    const [handle, avatar] = onClaim.mock.calls[0] ?? [];
    expect(handle).toBe("robin");
    expect(isAvatarConfig(avatar)).toBe(true);
  });

  it("allows skipping the name (passes undefined to onClaim)", async () => {
    const onClaim =
      vi.fn<(handle: string | undefined, avatar: unknown) => void>();
    render(<CreateFlow onClaim={onClaim} />);
    // Don't type anything — name is optional.
    await userEvent.click(
      screen.getByRole("button", { name: /create|continue|claim/i }),
    );
    expect(onClaim).toHaveBeenCalledTimes(1);
    const [handle] = onClaim.mock.calls[0] ?? [];
    expect(handle).toBeUndefined();
  });

  it("shows an error if a name is started but too short (under 3 chars)", async () => {
    render(<CreateFlow />);
    await userEvent.type(
      screen.getByPlaceholderText("Pick a display name"),
      "ab",
    );
    expect(screen.getByText("At least 3 characters.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create|continue|claim/i }),
    ).toBeDisabled();
  });
});
