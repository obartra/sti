// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  savePushContext,
  readPushContext,
  clearPushContext,
  type PushContext,
} from "./pushStore.ts";
import { mintNotify } from "../store/notifyInbox.ts";

function ctx(): PushContext {
  return { apiBase: "https://api.sti.care", cap: mintNotify() };
}

describe("pushStore (IndexedDB capability for the service worker)", () => {
  beforeEach(async () => {
    await clearPushContext();
  });

  it("is null before anything is saved", async () => {
    expect(await readPushContext()).toBeNull();
  });

  it("round-trips the saved push context", async () => {
    const c = ctx();
    await savePushContext(c);
    const got = await readPushContext();
    expect(got).toEqual(c);
  });

  it("overwrites on a second save (re-enable / rotated capability)", async () => {
    await savePushContext(ctx());
    const second = ctx();
    await savePushContext(second);
    expect(await readPushContext()).toEqual(second);
  });

  it("clear forgets the context (disable / logout)", async () => {
    await savePushContext(ctx());
    await clearPushContext();
    expect(await readPushContext()).toBeNull();
  });
});
