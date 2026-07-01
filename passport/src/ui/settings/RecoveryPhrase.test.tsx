import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecoveryPhrase } from "./RecoveryPhrase.tsx";

const PHRASE = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDEF";

// A present clipboard so the copy button reports success; kept as a local mock so
// the assertion never reads navigator.clipboard.writeText unbound.
let writeText: ReturnType<typeof vi.fn>;

describe("RecoveryPhrase", () => {
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays gated: the phrase is not shown on the first tap", async () => {
    render(<RecoveryPhrase phrase={PHRASE} />);
    // Collapsed by default: the phrase is nowhere on screen.
    expect(screen.queryByText(PHRASE)).not.toBeInTheDocument();

    // One tap opens the confirm gate with the surroundings warning, still no phrase.
    await userEvent.click(
      screen.getByRole("button", { name: "View recovery phrase" }),
    );
    expect(
      screen.getByText(
        "This is the key to your account. Make sure no one can see your screen before you show it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(PHRASE)).not.toBeInTheDocument();
  });

  it("reveals the phrase only after the explicit confirm, and hides again", async () => {
    render(<RecoveryPhrase phrase={PHRASE} />);
    await userEvent.click(
      screen.getByRole("button", { name: "View recovery phrase" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(screen.getByText(PHRASE)).toBeInTheDocument();

    // Hiding re-collapses back to the gated row.
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText(PHRASE)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View recovery phrase" }),
    ).toBeInTheDocument();
  });

  it("cancels the gate without revealing", async () => {
    render(<RecoveryPhrase phrase={PHRASE} />);
    await userEvent.click(
      screen.getByRole("button", { name: "View recovery phrase" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText(PHRASE)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View recovery phrase" }),
    ).toBeInTheDocument();
  });

  it("copies the phrase from the revealed view", async () => {
    render(<RecoveryPhrase phrase={PHRASE} />);
    await userEvent.click(
      screen.getByRole("button", { name: "View recovery phrase" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(PHRASE);
    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
  });

  it("shows the sign-in fallback when no phrase is stored, with no reveal control", () => {
    render(<RecoveryPhrase phrase={null} />);
    expect(
      screen.getByText(/Your recovery phrase isn't saved on this device\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View recovery phrase" }),
    ).not.toBeInTheDocument();
  });

  // With a passkey enrolled, the reveal is gated behind a passkey check (a WebAuthn
  // assertion): the phrase must not show until that check resolves true, and a
  // failed / cancelled check keeps it hidden with the plain retry line. The check
  // itself is mocked, so jsdom never runs real WebAuthn.
  describe("passkey-gated reveal", () => {
    it("does not reveal until the passkey check resolves successfully", async () => {
      const verify = vi.fn().mockResolvedValue(true);
      render(
        <RecoveryPhrase
          phrase={PHRASE}
          passkeyEnrolled
          onVerifyPasskey={verify}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: "View recovery phrase" }),
      );
      // The confirm step shows the passkey action, not the plain "Show it", and the
      // phrase is still hidden.
      expect(
        screen.getByRole("button", { name: "Confirm it's you" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Show it" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(PHRASE)).not.toBeInTheDocument();

      // The check runs on confirm; only then does the phrase reveal.
      await userEvent.click(
        screen.getByRole("button", { name: "Confirm it's you" }),
      );
      expect(verify).toHaveBeenCalledTimes(1);
      expect(screen.getByText(PHRASE)).toBeInTheDocument();
    });

    it("stays hidden with a plain message when the passkey check fails or is cancelled", async () => {
      const verify = vi.fn().mockResolvedValue(false);
      render(
        <RecoveryPhrase
          phrase={PHRASE}
          passkeyEnrolled
          onVerifyPasskey={verify}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: "View recovery phrase" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Confirm it's you" }),
      );
      expect(verify).toHaveBeenCalledTimes(1);
      // The phrase is never shown, and the plain, non-alarmist retry line appears.
      expect(screen.queryByText(PHRASE)).not.toBeInTheDocument();
      expect(
        screen.getByText("Couldn't confirm it was you. Try again."),
      ).toBeInTheDocument();
      // The confirm action is still there for a retry.
      expect(
        screen.getByRole("button", { name: "Confirm it's you" }),
      ).toBeInTheDocument();
    });

    it("falls back to the plain two-step confirm when no passkey is enrolled", async () => {
      const verify = vi.fn().mockResolvedValue(true);
      render(
        <RecoveryPhrase
          phrase={PHRASE}
          passkeyEnrolled={false}
          onVerifyPasskey={verify}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: "View recovery phrase" }),
      );
      // The plain "Show it" reveal, and no passkey check is ever run.
      await userEvent.click(screen.getByRole("button", { name: "Show it" }));
      expect(verify).not.toHaveBeenCalled();
      expect(screen.getByText(PHRASE)).toBeInTheDocument();
    });
  });
});
