import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { previewFace, IdentityChoiceRow } from "./ShareSheet.identity.tsx";

describe("previewFace", () => {
  const identity = { handle: "ari" };

  it("shows the owner's main face when main is chosen", () => {
    const face = previewFace({
      choice: "main",
      identity,
      avatarSrc: "data:avatar",
      seed: "a7f3k9q2",
      hasControl: true,
    });
    expect(face).toEqual({ handle: "ari", avatarSrc: "data:avatar" });
  });

  it("shows an unlinkable id-derived face when anonymous is chosen", () => {
    const face = previewFace({
      choice: "anonymous",
      identity,
      avatarSrc: "data:avatar",
      seed: "a7f3k9q2",
      hasControl: true,
    });
    // Not the owner's handle, and a face derived from the alias id (not the
    // owner's avatar) so it cannot be linked back.
    expect(face.handle).not.toBe("ari");
    expect(face.avatarSrc).not.toBe("data:avatar");
  });

  it("is deterministic per alias id (same seed, same face)", () => {
    const opts = {
      choice: "anonymous" as const,
      identity,
      avatarSrc: undefined,
      hasControl: true,
    };
    expect(previewFace({ ...opts, seed: "abc123" })).toEqual(
      previewFace({ ...opts, seed: "abc123" }),
    );
  });

  it("falls back to the main face when no control is wired (Storybook)", () => {
    const face = previewFace({
      choice: "anonymous",
      identity,
      avatarSrc: "data:avatar",
      seed: "a7f3k9q2",
      hasControl: false,
    });
    expect(face).toEqual({ handle: "ari", avatarSrc: "data:avatar" });
  });
});

describe("IdentityChoiceRow", () => {
  it("offers both faces and reports the chosen one", () => {
    const onChange = vi.fn();
    render(<IdentityChoiceRow choice="anonymous" onChange={onChange} />);
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Show my name/));
    expect(onChange).toHaveBeenCalledWith("main");
  });

  it("warns about findability only when the main face is chosen", () => {
    const warn = /can recognize you/;
    const { rerender } = render(
      <IdentityChoiceRow choice="anonymous" onChange={vi.fn()} />,
    );
    expect(screen.queryByText(warn)).toBeNull();
    rerender(<IdentityChoiceRow choice="main" onChange={vi.fn()} />);
    expect(screen.getByText(warn)).toBeInTheDocument();
  });
});
