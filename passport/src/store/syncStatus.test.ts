// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createSyncStatus, volatileSyncStorage } from "./syncStatus.ts";

const ID = "acct-1";

describe("sync status (slice 4 backed-up marker)", () => {
  it("starts synced (not pending, no timestamp, no version)", () => {
    const status = createSyncStatus(volatileSyncStorage());
    expect(status.snapshot(ID)).toEqual({
      pending: false,
      lastSyncedAt: null,
      version: null,
    });
  });

  it("markPending flips pending and notifies once", () => {
    const status = createSyncStatus(volatileSyncStorage());
    const listener = vi.fn();
    status.subscribe(listener);
    status.markPending(ID);
    expect(status.snapshot(ID).pending).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    // Already pending: no spurious notify.
    status.markPending(ID);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("markSynced clears pending and records the timestamp and version", () => {
    const status = createSyncStatus(volatileSyncStorage());
    status.markPending(ID);
    status.markSynced(ID, 1234, "7");
    expect(status.snapshot(ID)).toEqual({
      pending: false,
      lastSyncedAt: 1234,
      version: "7",
    });
  });

  it("setVersion records the base version without touching pending or the timestamp", () => {
    const status = createSyncStatus(volatileSyncStorage());
    const listener = vi.fn();
    status.subscribe(listener);
    status.setVersion(ID, "3");
    expect(status.snapshot(ID)).toEqual({
      pending: false,
      lastSyncedAt: null,
      version: "3",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    // markPending must preserve the recorded version.
    status.markPending(ID);
    expect(status.snapshot(ID).version).toBe("3");
    // Setting the same version again is a no-op (no spurious notify).
    status.setVersion(ID, "3");
    expect(listener).toHaveBeenCalledTimes(2); // one setVersion + one markPending
  });

  it("persists through the storage (survives a fresh instance)", () => {
    const storage = volatileSyncStorage();
    createSyncStatus(storage).markPending(ID);
    expect(createSyncStatus(storage).snapshot(ID).pending).toBe(true);
  });

  it("tracks accounts independently and stops notifying after unsubscribe", () => {
    const status = createSyncStatus(volatileSyncStorage());
    const listener = vi.fn();
    const unsub = status.subscribe(listener);
    status.markPending("a");
    expect(status.snapshot("b").pending).toBe(false);
    unsub();
    status.markPending("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
