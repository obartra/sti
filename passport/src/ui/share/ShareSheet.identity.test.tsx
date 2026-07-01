import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  previewFace,
  IdentityChoiceRow,
  FaceOverrideRow,
} from "./ShareSheet.identity.tsx";
import { avatarFor, pseudonymFor, DEFAULT_AVATAR } from "../../lib/avatars.ts";

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

  it("falls back to the id-derived pseudonym (never a blank @) when the owner has no name", () => {
    // A no-name owner's "main" link still resolves, for the viewer, to the
    // id-derived pseudonym handle plus their real avatar. The preview must match
    // that, not render an empty "@".
    const face = previewFace({
      choice: "main",
      identity: {},
      avatarSrc: "data:avatar",
      seed: "a7f3k9q2",
      hasControl: true,
    });
    expect(face.handle).toBe(pseudonymFor("a7f3k9q2"));
    expect(face.handle).not.toBe("");
    // The avatar is still the owner's real one (what a "main" link actually shows).
    expect(face.avatarSrc).toBe("data:avatar");
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
    // G7: the avatar is seeded on the OPAQUE ID, not the (user-readable) derived
    // handle. Seeding on the handle would re-introduce an identifying seed.
    expect(face.avatarSrc).toBe(avatarFor("a7f3k9q2"));
    expect(face.avatarSrc).not.toBe(avatarFor(pseudonymFor("a7f3k9q2")));
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

  it("a per-link override wins over the account face on a main link (doc 15)", () => {
    const face = previewFace({
      choice: "main",
      identity,
      avatarSrc: "data:account",
      seed: "a7f3k9q2",
      hasControl: true,
      overrideSrc: "data:override",
    });
    expect(face).toEqual({ handle: "ari", avatarSrc: "data:override" });
  });
});

describe("FaceOverrideRow", () => {
  it("is hidden on an anonymous link (nothing to override)", () => {
    const { container } = render(
      <FaceOverrideRow
        choice="anonymous"
        override={undefined}
        fallback={DEFAULT_AVATAR}
        onChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden when no control is wired (Storybook)", () => {
    const { container } = render(
      <FaceOverrideRow
        choice="main"
        override={undefined}
        fallback={DEFAULT_AVATAR}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers to pick a face on a revealed link, then opens the builder", () => {
    render(
      <FaceOverrideRow
        choice="main"
        override={undefined}
        fallback={DEFAULT_AVATAR}
        onChange={vi.fn()}
      />,
    );
    // Collapsed: the pick control, no reset yet (no override).
    expect(screen.getByText("Pick a face")).toBeInTheDocument();
    expect(screen.queryByText("Use my default")).toBeNull();
    fireEvent.click(screen.getByText("Pick a face"));
    // Expanded: the avatar builder is present (its "Surprise me" shuffle).
    expect(screen.getByText(/Surprise me/)).toBeInTheDocument();
  });

  it("clearing the override reports undefined and closes the builder", () => {
    const onChange = vi.fn();
    const override = { hair: 1, mood: 2, skin: 2, hairColor: 4, beard: 0 };
    render(
      <FaceOverrideRow
        choice="main"
        override={override}
        fallback={DEFAULT_AVATAR}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Pick a face"));
    fireEvent.click(screen.getByText("Use my default"));
    expect(onChange).toHaveBeenCalledWith(undefined);
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

  it("hides the choice when the owner has no display name (nothing to show)", () => {
    const { container } = render(
      <IdentityChoiceRow
        choice="anonymous"
        hasName={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("Anonymous")).toBeNull();
    expect(screen.queryByText(/Show my name/)).toBeNull();
    expect(container).toBeEmptyDOMElement();
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
