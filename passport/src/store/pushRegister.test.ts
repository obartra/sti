// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import {
  enablePush,
  disablePush,
  type PushPlatform,
  type EnablePushDeps,
} from "./pushRegister.ts";
import { routingHash } from "./partnerNotify.ts";
import { mintNotify } from "./notifyInbox.ts";
import { readPushContext } from "../sw/pushStore.ts";
import type { PushSubscription } from "../api/contract.ts";

const SUB: PushSubscription = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "p", auth: "a" },
};

function platform(over: Partial<PushPlatform> = {}): PushPlatform {
  return {
    supported: () => true,
    requestPermission: () => Promise.resolve("granted"),
    subscribe: () => Promise.resolve(SUB),
    unsubscribe: () => Promise.resolve(),
    ...over,
  };
}

function deps(over: Partial<EnablePushDeps> = {}): EnablePushDeps {
  return {
    api: {
      getVapidPublicKey: () => Promise.resolve("VAPID_PUB"),
      registerPush: vi.fn(() => Promise.resolve()),
    },
    platform: platform(),
    cap: mintNotify(),
    apiBase: "https://api.sti.care",
    ...over,
  };
}

describe("enablePush", () => {
  it("registers under hash(routingToken) and saves the worker capability", async () => {
    const d = deps();
    const result = await enablePush(d);
    expect(result).toBe("enabled");

    const expectedId = await routingHash(d.cap.routingToken);
    expect(d.api.registerPush).toHaveBeenCalledWith({
      routingEndpointId: expectedId,
      subscription: SUB,
    });
    // The worker can now poll: the capability is in IndexedDB.
    expect(await readPushContext()).toEqual({
      apiBase: "https://api.sti.care",
      cap: d.cap,
    });
  });

  it("stops at unsupported (no key fetch, no register)", async () => {
    const registerPush = vi.fn(() => Promise.resolve());
    const getVapidPublicKey = vi.fn(() => Promise.resolve("VAPID_PUB"));
    const result = await enablePush(
      deps({
        platform: platform({ supported: () => false }),
        api: { getVapidPublicKey, registerPush },
      }),
    );
    expect(result).toBe("unsupported");
    expect(getVapidPublicKey).not.toHaveBeenCalled();
    expect(registerPush).not.toHaveBeenCalled();
  });

  it("stops at no-keys when the server has no VAPID key configured", async () => {
    const registerPush = vi.fn(() => Promise.resolve());
    const result = await enablePush(
      deps({
        api: {
          getVapidPublicKey: () => Promise.resolve(null),
          registerPush,
        },
      }),
    );
    expect(result).toBe("no-keys");
    expect(registerPush).not.toHaveBeenCalled();
  });

  it("stops at denied without registering when permission is refused", async () => {
    const registerPush = vi.fn(() => Promise.resolve());
    const result = await enablePush(
      deps({
        platform: platform({
          requestPermission: () => Promise.resolve("denied"),
        }),
        api: {
          getVapidPublicKey: () => Promise.resolve("VAPID_PUB"),
          registerPush,
        },
      }),
    );
    expect(result).toBe("denied");
    expect(registerPush).not.toHaveBeenCalled();
  });
});

describe("disablePush", () => {
  it("clears the worker capability and unsubscribes", async () => {
    await enablePush(deps());
    expect(await readPushContext()).not.toBeNull();

    const unsubscribe = vi.fn(() => Promise.resolve());
    await disablePush(platform({ unsubscribe }));
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(await readPushContext()).toBeNull();
  });
});
