import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ShareSheet } from "./ShareSheet.tsx";

const base = {
  open: true,
  state: "gray" as const,
  identity: { handle: "ari" },
};

describe("ShareSheet link wiring", () => {
  it("shows the real shareable link (scheme stripped), not the placeholder", () => {
    const id = "z".repeat(43);
    render(
      <ShareSheet
        {...base}
        sharingMode="link"
        url={`https://sti.care/a/${id}`}
      />,
    );
    expect(screen.getByText(`sti.care/a/${id}`)).toBeInTheDocument();
    // The hardcoded placeholder must not leak through once a real link exists.
    expect(screen.queryByText(/a7f3k9q2/)).toBeNull();
  });

  it("Copy link invokes the real-link copy handler", () => {
    const onCopy = vi.fn();
    render(
      <ShareSheet
        {...base}
        sharingMode="link"
        url="https://sti.care/a/abc"
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByText("Copy link"));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it("falls back to a placeholder link when no real link is supplied (Storybook)", () => {
    render(<ShareSheet {...base} sharingMode="link" />);
    expect(screen.getByText("sti.care/a/a7f3k9q2")).toBeInTheDocument();
  });

  it("closed: a viewport-fixed, non-interactive layer (won't park mid-page or block taps)", () => {
    const { container } = render(<ShareSheet {...base} open={false} />);
    const overlay = container.querySelector<HTMLElement>("[data-share-overlay]");
    expect(overlay).not.toBeNull();
    // `fixed` keeps it pinned to the viewport instead of anchoring to the
    // document and showing through partway down a long page.
    expect(overlay?.style.position).toBe("fixed");
    expect(overlay?.style.pointerEvents).toBe("none");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("open: the overlay becomes interactive", () => {
    const { container } = render(<ShareSheet {...base} open />);
    const overlay = container.querySelector<HTMLElement>("[data-share-overlay]");
    expect(overlay?.style.pointerEvents).toBe("auto");
    expect(overlay).toHaveAttribute("aria-hidden", "false");
  });

  it("hides the wallet row when showWallet is false (feature gated off)", () => {
    const wallet = "Add to Apple or Google Wallet";
    // Default shows it (the component's full form, kept for Storybook)...
    const { rerender } = render(<ShareSheet {...base} />);
    expect(screen.getByText(wallet)).toBeInTheDocument();
    // ...but the app passes showWallet=WALLET_ENABLED (false), hiding the path.
    rerender(<ShareSheet {...base} showWallet={false} />);
    expect(screen.queryByText(wallet)).toBeNull();
  });
});
