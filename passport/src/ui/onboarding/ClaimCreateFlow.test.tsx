import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CreateFlow } from "./ClaimCreateFlow.tsx";
import { isAvatarConfig } from "../../lib/avatars.ts";

describe("create-account flow (doc 19)", () => {
  it("collects only the name, no avatar builder", () => {
    render(<CreateFlow />);
    // The avatar builder is gone from signup; no Surprise me or color rows here.
    expect(
      screen.queryByRole("button", { name: "Surprise me" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Skin")).not.toBeInTheDocument();
    // The flow collects the name via a single labeled field.
    expect(
      screen.getByLabelText("What should we call you?"),
    ).toBeInTheDocument();
  });

  it("passes a valid (random) avatar to onClaim", async () => {
    const onClaim =
      vi.fn<(handle: string | undefined, avatar: unknown) => void>();
    render(<CreateFlow onClaim={onClaim} />);
    await userEvent.type(
      screen.getByLabelText("What should we call you?"),
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
    // Don't type anything; the name is optional.
    await userEvent.click(
      screen.getByRole("button", { name: /create|continue|claim/i }),
    );
    expect(onClaim).toHaveBeenCalledTimes(1);
    const [handle] = onClaim.mock.calls[0] ?? [];
    expect(handle).toBeUndefined();
  });

  it("the shuffle button fills a name into the field", async () => {
    render(<CreateFlow />);
    const field = screen.getByLabelText<HTMLInputElement>(
      "What should we call you?",
    );
    expect(field.value).toBe("");
    await userEvent.click(
      screen.getByRole("button", { name: "Shuffle a name" }),
    );
    // A non-empty, handle-shaped name is filled in.
    expect(field.value.length).toBeGreaterThan(0);
    expect(field.value).toMatch(/^[a-z0-9_]+$/);
  });

  it("shows an error if a name is started but too short (under 3 chars)", async () => {
    render(<CreateFlow />);
    await userEvent.type(
      screen.getByLabelText("What should we call you?"),
      "ab",
    );
    expect(screen.getByText("At least 3 characters.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create|continue|claim/i }),
    ).toBeDisabled();
  });
});
