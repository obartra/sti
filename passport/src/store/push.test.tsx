// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enablePush, disablePush, pushSupported, pushEnabled } from "./push.ts";
import type { ApiClient } from "../api/client.ts";
import type { NotifyCapability } from "./notifyInbox.ts";
import { sha256Base64url, utf8ToBytes } from "../crypto/index.ts";

// Mock the IndexedDB-backed worker store so the flow is testable without a real DB.
const saved: { ctx: unknown } = { ctx: undefined };
vi.mock("../sw/pushStore.ts", () => ({
  savePushContext: vi.fn((ctx: unknown) => {
    saved.ctx = ctx;
    return Promise.resolve();
  }),
  clearPushContext: vi.fn(() => {
    saved.ctx = undefined;
    return Promise.resolve();
  }),
  readPushContext: vi.fn(() => Promise.resolve(saved.ctx ?? null)),
}));

const cap: NotifyCapability = {
  inboxId: "i".repeat(43),
  writeToken: "w".repeat(43),
  key: "k",
  routingToken: "route-token-123",
};
const cap2: NotifyCapability = {
  inboxId: "j".repeat(43),
  writeToken: "x".repeat(43),
  key: "m",
  routingToken: "route-token-456",
};

function fakeApi(over: Partial<ApiClient> = {}): ApiClient {
  return {
    getVapidPublicKey: () => Promise.resolve("VVZBUElEX1BVQg"), // base64url
    registerPush: vi.fn(() => Promise.resolve()),
    ...(over as object),
  } as unknown as ApiClient;
}

// Install fake push-capable browser globals; returns the subscribe spy.
function installPushEnv(
  opts: {
    permission?: NotificationPermission;
    subJson?: { endpoint?: string; keys?: { p256dh: string; auth: string } };
  } = {},
) {
  const sub = {
    toJSON: () =>
      opts.subJson ?? {
        endpoint: "https://push.example/abc",
        keys: { p256dh: "p256", auth: "authk" },
      },
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  const pushManager = {
    subscribe: vi.fn(() => Promise.resolve(sub)),
    getSubscription: vi.fn(() => Promise.resolve(sub)),
  };
  const reg = { pushManager };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn(() => Promise.resolve(reg)),
      getRegistration: vi.fn(() => Promise.resolve(reg)),
    },
  });
  vi.stubGlobal("Notification", {
    requestPermission: vi.fn(() =>
      Promise.resolve(opts.permission ?? "granted"),
    ),
  });
  // Any truthy value: pushSupported only checks `"PushManager" in window`.
  (window as unknown as { PushManager: unknown }).PushManager = {};
  return { sub, pushManager };
}

beforeEach(() => {
  saved.ctx = undefined;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("push enable/disable", () => {
  it("is unsupported when the browser lacks push APIs", () => {
    // No PushManager / Notification in plain jsdom.
    expect(pushSupported()).toBe(false);
  });

  it("enables: subscribes, registers under the routing hash, stores the context", async () => {
    installPushEnv();
    const registerPush = vi.fn(() => Promise.resolve());
    const api = fakeApi({ registerPush });

    const result = await enablePush(api, "https://api.test", [cap]);
    expect(result).toBe("enabled");

    const expectedId = await sha256Base64url(utf8ToBytes(cap.routingToken));
    expect(registerPush).toHaveBeenCalledWith({
      routingEndpointId: expectedId,
      subscription: {
        endpoint: "https://push.example/abc",
        keys: { p256dh: "p256", auth: "authk" },
      },
    });
    // The worker context (api base + the per-contact caps) is persisted.
    expect(saved.ctx).toEqual({ apiBase: "https://api.test", caps: [cap] });
  });

  it("registers EACH per-contact routing token under the one subscription", async () => {
    installPushEnv();
    const ids: string[] = [];
    const registerPush = vi.fn((arg: { routingEndpointId: string }) => {
      ids.push(arg.routingEndpointId);
      return Promise.resolve();
    });
    const api = fakeApi({ registerPush });

    const result = await enablePush(api, "https://api.test", [cap, cap2]);
    expect(result).toBe("enabled");

    // One registration per contact inbox, each under that contact's routing-token
    // hash, so a wake from any contact reaches this device.
    const id1 = await sha256Base64url(utf8ToBytes(cap.routingToken));
    const id2 = await sha256Base64url(utf8ToBytes(cap2.routingToken));
    expect(new Set(ids)).toEqual(new Set([id1, id2]));
    expect(saved.ctx).toEqual({
      apiBase: "https://api.test",
      caps: [cap, cap2],
    });
  });

  it("returns 'denied' and stores nothing when permission is refused", async () => {
    installPushEnv({ permission: "denied" });
    const registerPush = vi.fn(() => Promise.resolve());
    const result = await enablePush(fakeApi({ registerPush }), "x", [cap]);
    expect(result).toBe("denied");
    expect(registerPush).not.toHaveBeenCalled();
    expect(saved.ctx).toBeUndefined();
  });

  it("surfaces the real cause when subscribe fails (not a dead-end)", async () => {
    const { pushManager } = installPushEnv();
    const err = new Error("Registration failed - push service error");
    err.name = "AbortError";
    pushManager.subscribe = vi.fn(() => Promise.reject(err));
    const result = await enablePush(fakeApi(), "x", [cap]);
    expect(result).toEqual({
      failed: "AbortError: Registration failed - push service error",
    });
    expect(saved.ctx).toBeUndefined();
  });

  it("maps a NotAllowedError thrown by subscribe to 'denied'", async () => {
    const { pushManager } = installPushEnv();
    const err = new Error("permission denied");
    err.name = "NotAllowedError";
    pushManager.subscribe = vi.fn(() => Promise.reject(err));
    expect(await enablePush(fakeApi(), "x", [cap])).toBe("denied");
  });

  it("returns 'unconfigured' when the server has no VAPID key", async () => {
    installPushEnv();
    const result = await enablePush(
      fakeApi({ getVapidPublicKey: () => Promise.resolve(null) }),
      "x",
      [cap],
    );
    expect(result).toBe("unconfigured");
    expect(saved.ctx).toBeUndefined();
  });

  it("pushEnabled is true only for the exact per-contact inbox set stored", async () => {
    saved.ctx = { apiBase: "x", caps: [cap, cap2] };
    // The full set matches (order-independent).
    expect(await pushEnabled([cap.inboxId, cap2.inboxId])).toBe(true);
    expect(await pushEnabled([cap2.inboxId, cap.inboxId])).toBe(true);
    // A subset, a superset, a different set, and the empty set are all "off" so the
    // UI re-prompts when the contact set changed.
    expect(await pushEnabled([cap.inboxId])).toBe(false);
    expect(await pushEnabled([cap.inboxId, cap2.inboxId, "z".repeat(43)])).toBe(
      false,
    );
    expect(await pushEnabled(["z".repeat(43)])).toBe(false);
    expect(await pushEnabled([])).toBe(false); // logged out / no contacts
    saved.ctx = undefined;
    expect(await pushEnabled([cap.inboxId, cap2.inboxId])).toBe(false);
  });

  it("disable unsubscribes and clears the worker context", async () => {
    const { sub } = installPushEnv();
    saved.ctx = { apiBase: "x", caps: [cap] };
    await disablePush();
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
    expect(saved.ctx).toBeUndefined();
  });
});
