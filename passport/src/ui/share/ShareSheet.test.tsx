import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ShareSheet } from "./ShareSheet.tsx";

const base = {
  open: true,
  state: "gray" as const,
  identity: { handle: "ari" },
};

afterEach(() => {
  // Tests that add a native share API clean it up so others see "no share".
  if ("share" in navigator) {
    delete (navigator as { share?: unknown }).share;
  }
});

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

  it("frames a public name link (/u/) as findable + ask-first, not direct view", () => {
    render(
      <ShareSheet
        {...base}
        sharingMode="public"
        url="https://sti.care/u/meow"
      />,
    );
    expect(screen.getByText("sti.care/u/meow")).toBeInTheDocument();
    // The card calls it a public name and is honest that it is knock-gated, never
    // the "anyone who scans sees this status" line used for the direct /a/ link.
    expect(screen.getByText("Public name")).toBeInTheDocument();
    expect(
      screen.getByText(/find you by name and ask before they see your status/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Anyone who scans/)).toBeNull();
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

  it("falls back to a placeholder link only when no link is wired (undefined, Storybook)", () => {
    render(<ShareSheet {...base} sharingMode="link" />);
    expect(screen.getByText("sti.care/a/a7f3k9q2")).toBeInTheDocument();
  });

  it("while the link is preparing (null url) it shows no fake link, just a status", () => {
    render(<ShareSheet {...base} sharingMode="public" url={null} />);
    // The hardcoded placeholder must never stand in for a real, not-yet-minted link.
    expect(screen.queryByText(/a7f3k9q2/)).toBeNull();
    expect(screen.getByText("Getting your link ready")).toBeInTheDocument();
    // No copy/save while there's nothing to copy.
    expect(screen.queryByText("Copy link")).toBeNull();
  });

  it("when the prepare fails it shows a failure message and a working retry", () => {
    const onRetry = vi.fn();
    render(
      <ShareSheet
        {...base}
        sharingMode="public"
        url={null}
        error
        onRetry={onRetry}
      />,
    );
    expect(screen.queryByText(/a7f3k9q2/)).toBeNull();
    expect(screen.getByText(/We couldn't make your link/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers a lifetime control on the private link, not the public profile (doc 16)", () => {
    // The private link can be given a lifetime (a link you hand to one person can
    // sensibly lapse); the public profile is durable, so it has no such control.
    const { rerender } = render(
      <ShareSheet
        {...base}
        sharingMode="link"
        url="https://sti.care/a/abc"
        onLifetimeChange={() => undefined}
      />,
    );
    expect(screen.getByText("Link lasts")).toBeInTheDocument();
    rerender(
      <ShareSheet
        {...base}
        sharingMode="public"
        url="https://sti.care/a/abc"
        onLifetimeChange={() => undefined}
      />,
    );
    // Even with a handler wired, public mode never surfaces the control.
    expect(screen.queryByText("Link lasts")).toBeNull();
  });

  it("picking a lifetime reports the chosen duration in ms (doc 16)", () => {
    const onLifetimeChange = vi.fn();
    render(
      <ShareSheet
        {...base}
        sharingMode="link"
        url="https://sti.care/a/abc"
        onLifetimeChange={onLifetimeChange}
      />,
    );
    fireEvent.click(screen.getByText("7 days"));
    expect(onLifetimeChange).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000);
    fireEvent.click(screen.getByText("Until I turn it off"));
    expect(onLifetimeChange).toHaveBeenLastCalledWith(null);
  });

  it("closed: a viewport-fixed, non-interactive layer (won't park mid-page or block taps)", () => {
    const { container } = render(<ShareSheet {...base} open={false} />);
    const overlay = container.querySelector<HTMLElement>(
      "[data-share-overlay]",
    );
    expect(overlay).not.toBeNull();
    // `fixed` keeps it pinned to the viewport instead of anchoring to the
    // document and showing through partway down a long page.
    expect(overlay?.style.position).toBe("fixed");
    expect(overlay?.style.pointerEvents).toBe("none");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("open: the overlay becomes interactive", () => {
    const { container } = render(<ShareSheet {...base} open />);
    const overlay = container.querySelector<HTMLElement>(
      "[data-share-overlay]",
    );
    expect(overlay?.style.pointerEvents).toBe("auto");
    expect(overlay).toHaveAttribute("aria-hidden", "false");
  });

  it("Copy link confirms with a Copied state when the copy succeeds", () => {
    render(<ShareSheet {...base} sharingMode="link" onCopy={() => true} />);
    fireEvent.click(screen.getByText("Copy link"));
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("without a native share API, the primary button reads Done and closes", () => {
    const onClose = vi.fn();
    render(<ShareSheet {...base} onClose={onClose} />);
    // jsdom has no navigator.share, so there's nothing to share to: just close.
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("with a native share API, Share hands off the link and then closes", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    const onClose = vi.fn();
    const id = "z".repeat(43);
    render(
      <ShareSheet
        {...base}
        sharingMode="link"
        url={`https://sti.care/a/${id}`}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `https://sti.care/a/${id}` }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
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
