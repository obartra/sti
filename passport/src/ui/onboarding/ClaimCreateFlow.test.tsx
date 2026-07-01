import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CreateFlow } from "./ClaimCreateFlow.tsx";
import { isAvatarConfig } from "../../lib/avatars.ts";
import type { SignUpRecovery } from "../../store/index.ts";
import type { ClaimResult } from "../app/useOnboarding.ts";

// A strong passphrase that clears the strength gate (score 4, not a common password).
const STRONG = "correct-horse-battery-staple-42";

// The claim callback the flow calls; resolves with a ClaimResult (default: created,
// no optional-password outcome). Tests can override the outcome to drive the taken-
// Username path.
function claimSpy(recoveryOutcome?: ClaimResult["recoveryOutcome"]) {
  return vi.fn<
    (
      handle: string | undefined,
      avatar: unknown,
      recovery?: SignUpRecovery,
    ) => Promise<ClaimResult>
  >(() =>
    Promise.resolve(
      recoveryOutcome !== undefined
        ? { created: true, recoveryOutcome }
        : { created: true },
    ),
  );
}

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
    const onClaim = claimSpy();
    render(<CreateFlow onClaim={onClaim} />);
    await userEvent.type(
      screen.getByLabelText("What should we call you?"),
      "robin",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create|continue|claim/i }),
    );
    expect(onClaim).toHaveBeenCalledTimes(1);
    const [handle, avatar, recovery] = onClaim.mock.calls[0] ?? [];
    expect(handle).toBe("robin");
    expect(isAvatarConfig(avatar)).toBe(true);
    // No password chosen by default: the optional recovery is undefined.
    expect(recovery).toBeUndefined();
  });

  it("allows skipping the name (passes undefined to onClaim)", async () => {
    const onClaim = claimSpy();
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

describe("optional password at sign-up (doc 32)", () => {
  // The password fields live behind a disclosure so the default stays passkey-only.
  it("hides the password fields until the disclosure is opened", async () => {
    render(<CreateFlow onClaim={claimSpy()} />);
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /add a username and password/i }),
    );
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("creates a passkey/phrase account when the disclosure is left untouched", async () => {
    const onClaim = claimSpy();
    render(<CreateFlow onClaim={onClaim} />);
    await userEvent.type(
      screen.getByLabelText("What should we call you?"),
      "robin",
    );
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    const [, , recovery] = onClaim.mock.calls[0] ?? [];
    expect(recovery).toBeUndefined();
  });

  it("passes the Username + password to onClaim when both are set", async () => {
    const onClaim = claimSpy("set");
    render(<CreateFlow onClaim={onClaim} />);
    await userEvent.click(
      screen.getByRole("button", { name: /add a username and password/i }),
    );
    await userEvent.type(screen.getByLabelText("Username"), "robin_backup");
    await userEvent.type(screen.getByLabelText("Password"), STRONG);
    await userEvent.type(screen.getByLabelText("Confirm password"), STRONG);
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(onClaim).toHaveBeenCalledTimes(1));
    const [, , recovery] = onClaim.mock.calls[0] ?? [];
    expect(recovery).toEqual({
      recoveryName: "robin_backup",
      password: STRONG,
    });
  });

  it("gates a weak password: submit is blocked until it is strong", async () => {
    const onClaim = claimSpy("set");
    render(<CreateFlow onClaim={onClaim} />);
    await userEvent.click(
      screen.getByRole("button", { name: /add a username and password/i }),
    );
    await userEvent.type(screen.getByLabelText("Username"), "robin_backup");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    // A weak password blocks Continue (the strength gate), so no claim fires.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled(),
    );
    expect(onClaim).not.toHaveBeenCalled();
  });

  it("shows an inline error on a taken Username and stays on this step", async () => {
    // The parent returns nameUnavailable but keeps `created: true`; the flow shows
    // the inline error and does not clear the fields, so the owner can retry.
    const onClaim = claimSpy("nameUnavailable");
    render(<CreateFlow onClaim={onClaim} />);
    await userEvent.click(
      screen.getByRole("button", { name: /add a username and password/i }),
    );
    await userEvent.type(screen.getByLabelText("Username"), "robin_backup");
    await userEvent.type(screen.getByLabelText("Password"), STRONG);
    await userEvent.type(screen.getByLabelText("Confirm password"), STRONG);
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(
      await screen.findByText(/that username is taken/i),
    ).toBeInTheDocument();
  });
});
