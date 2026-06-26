import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBackupSync } from "./useBackupSync.ts";
import {
  createSyncStatus,
  type OfflineAccountSync,
  type OwnerSession,
} from "../../store/index.ts";
import { volatileSyncStorage } from "../../store/syncStatus.ts";

const ID = "acct-1";
// The hook only reads offlineSync.accountId and session.master.
const offlineSync = {
  accountId: () => Promise.resolve(ID),
} as unknown as OfflineAccountSync;
const session = { master: new Uint8Array(32) } as unknown as OwnerSession;

describe("useBackupSync (slice 4 reconnect drain)", () => {
  it("reports pending and drains on reconnect when work is owed", async () => {
    const status = createSyncStatus(volatileSyncStorage());
    status.markPending(ID);
    const setOwnerState = vi.fn();

    const { result } = renderHook(() =>
      useBackupSync(status, offlineSync, session, setOwnerState),
    );

    // Already online + pending: drains on mount and reports pending.
    await waitFor(() => expect(setOwnerState).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(true);

    // A reconnect with work still owed drains again. The handler only calls the
    // setOwnerState mock (no React state update), so no act() wrapping is needed.
    window.dispatchEvent(new Event("online"));
    expect(setOwnerState).toHaveBeenCalledTimes(2);
  });

  it("does nothing when nothing is pending", async () => {
    const status = createSyncStatus(volatileSyncStorage());
    const setOwnerState = vi.fn();

    const { result } = renderHook(() =>
      useBackupSync(status, offlineSync, session, setOwnerState),
    );

    await waitFor(() => expect(result.current).toBe(false));
    window.dispatchEvent(new Event("online"));
    expect(setOwnerState).not.toHaveBeenCalled();
  });

  it("is inert with no session", () => {
    const status = createSyncStatus(volatileSyncStorage());
    const setOwnerState = vi.fn();
    const { result } = renderHook(() =>
      useBackupSync(status, offlineSync, null, setOwnerState),
    );
    expect(result.current).toBe(false);
    expect(setOwnerState).not.toHaveBeenCalled();
  });
});
