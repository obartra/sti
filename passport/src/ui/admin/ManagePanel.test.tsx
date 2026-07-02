import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ManagePanel, type ManageOps } from "./ManagePanel.tsx";
import type { AdminActionResult, AdminLookupResult } from "./adminApi.ts";

function renderPanel(over: Partial<ManageOps> = {}, onUnauthorized = vi.fn()) {
  const ops: ManageOps = {
    lookup: () => Promise.resolve(emptyRecord()),
    disable: () => Promise.resolve("ok" as AdminActionResult),
    revoke: () => Promise.resolve("ok" as AdminActionResult),
    ...over,
  };
  render(<ManagePanel token="t" ops={ops} onUnauthorized={onUnauthorized} />);
  return { ops, onUnauthorized };
}

// A found record: only the link namespace is present (an id is namespace-specific in
// practice), with a known ciphertext size and last-written instant.
const foundRecord = (): AdminLookupResult => ({
  kind: "ok",
  record: {
    alias: {
      exists: true,
      sizeBytes: 2048,
      updatedAt: Date.UTC(2026, 5, 25, 14, 30, 0),
    },
    account: { exists: false, sizeBytes: 0, updatedAt: 0 },
    inbox: { exists: false, sizeBytes: 0, updatedAt: 0 },
  },
});

// A miss: nothing exists in any namespace for the id.
const emptyRecord = (): AdminLookupResult => ({
  kind: "ok",
  record: {
    alias: { exists: false, sizeBytes: 0, updatedAt: 0 },
    account: { exists: false, sizeBytes: 0, updatedAt: 0 },
    inbox: { exists: false, sizeBytes: 0, updatedAt: 0 },
  },
});

async function lookUp(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.type(screen.getByLabelText(/record id/i), id);
  await user.click(screen.getByRole("button", { name: /look up/i }));
}

describe("ManagePanel", () => {
  it("renders the three metadata cards (exists / size / updated) and no content", async () => {
    const user = userEvent.setup();
    renderPanel({ lookup: () => Promise.resolve(foundRecord()) });

    await lookUp(user, "a1b2c3");

    // The three namespace cards, each labelled and showing presence only.
    expect(await screen.findByText("Link")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    // Metadata only: presence, human byte size, and the last-written UTC time.
    expect(screen.getByText("Present")).toBeInTheDocument();
    expect(screen.getAllByText("None").length).toBe(2); // account + inbox absent
    expect(
      screen.getByText(/2\.0 KB · 2026-06-25 14:30 UTC/),
    ).toBeInTheDocument();
    // The operator-typed id is echoed back.
    expect(screen.getByText("a1b2c3")).toBeInTheDocument();
    // Never any decrypted field: there is none to show (the store holds only
    // ciphertext, and the lookup returns metadata alone). Guard against any marker
    // of a leaked content value (the panel's own copy never uses these words).
    expect(
      screen.queryByText(/ciphertext|plaintext|decrypted|profile|handle/i),
    ).not.toBeInTheDocument();
  });

  it("shows a plain not-found notice when no namespace exists", async () => {
    const user = userEvent.setup();
    renderPanel({ lookup: () => Promise.resolve(emptyRecord()) });

    await lookUp(user, "missing");
    expect(
      await screen.findByText(/no record for that id/i),
    ).toBeInTheDocument();
  });

  it("requires a second click to confirm before disabling an account", async () => {
    const user = userEvent.setup();
    const disable = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ lookup: () => Promise.resolve(foundRecord()), disable });

    await lookUp(user, "acc1");
    const btn = await screen.findByRole("button", { name: /disable account/i });

    // First click only arms: the op must NOT fire.
    await user.click(btn);
    expect(disable).not.toHaveBeenCalled();
    // The label flips to the confirm copy.
    expect(screen.getByText(/clears the sync backup/i)).toBeInTheDocument();

    // Second click confirms and fires the op with the looked-up id.
    await user.click(btn);
    expect(disable).toHaveBeenCalledWith("t", "acc1");
  });

  it("requires a second click to confirm before revoking a link", async () => {
    const user = userEvent.setup();
    const revoke = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ lookup: () => Promise.resolve(foundRecord()), revoke });

    await lookUp(user, "lnk1");
    const btn = await screen.findByRole("button", { name: /revoke link/i });

    await user.click(btn);
    expect(revoke).not.toHaveBeenCalled();
    expect(screen.getByText(/locked for 24 hours/i)).toBeInTheDocument();

    await user.click(btn);
    expect(revoke).toHaveBeenCalledWith("t", "lnk1");
  });

  it("re-looks-up after a successful action to reflect the change", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn(() => Promise.resolve(foundRecord()));
    const disable = vi.fn(() => Promise.resolve("ok" as const));
    renderPanel({ lookup, disable });

    await lookUp(user, "acc1");
    const btn = await screen.findByRole("button", { name: /disable account/i });
    await user.click(btn); // arm
    await user.click(btn); // confirm

    // Initial lookup + the post-action refresh, both against the same id.
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
    expect(lookup).toHaveBeenLastCalledWith("t", "acc1");
  });

  it("re-locks (onUnauthorized) when the lookup is rejected with 401", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      { lookup: () => Promise.resolve({ kind: "unauthorized" }) },
      onUnauthorized,
    );
    await lookUp(user, "x");
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("re-locks (onUnauthorized) when an action is rejected with 401", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      {
        lookup: () => Promise.resolve(foundRecord()),
        revoke: () => Promise.resolve("unauthorized"),
      },
      onUnauthorized,
    );
    await lookUp(user, "lnk1");
    const btn = await screen.findByRole("button", { name: /revoke link/i });
    await user.click(btn); // arm
    await user.click(btn); // confirm
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows a plain notice (no re-lock) when an action transport-errors", async () => {
    const user = userEvent.setup();
    const onUnauthorized = vi.fn();
    renderPanel(
      {
        lookup: () => Promise.resolve(foundRecord()),
        disable: () => Promise.resolve("error"),
      },
      onUnauthorized,
    );
    await lookUp(user, "acc1");
    const btn = await screen.findByRole("button", { name: /disable account/i });
    await user.click(btn); // arm
    await user.click(btn); // confirm
    expect(await screen.findByText(/didn't go through/i)).toBeInTheDocument();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("shows a load error and retries the same id", async () => {
    const user = userEvent.setup();
    const lookup = vi
      .fn<ManageOps["lookup"]>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValueOnce(foundRecord());
    renderPanel({ lookup });

    await lookUp(user, "acc1");
    expect(
      await screen.findByText(/couldn't look that up/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Present")).toBeInTheDocument();
    expect(lookup).toHaveBeenLastCalledWith("t", "acc1");
  });
});
