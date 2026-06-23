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

    const result = await enablePush(api, "https://api.test", cap);
    expect(result).toBe("enabled");

    const expectedId = await sha256Base64url(utf8ToBytes(cap.routingToken));
    expect(registerPush).toHaveBeenCalledWith({
      routingEndpointId: expectedId,
      subscription: {
        endpoint: "https://push.example/abc",
        keys: { p256dh: "p256", auth: "authk" },
      },
    });
    // The worker context (api base + this device's cap) is persisted.
    expect(saved.ctx).toEqual({ apiBase: "https://api.test", cap });
  });

  it("returns 'denied' and stores nothing when permission is refused", async () => {
    installPushEnv({ permission: "denied" });
    const registerPush = vi.fn(() => Promise.resolve());
    const result = await enablePush(fakeApi({ registerPush }), "x", cap);
    expect(result).toBe("denied");
    expect(registerPush).not.toHaveBeenCalled();
    expect(saved.ctx).toBeUndefined();
  });

  it("returns 'unconfigured' when the server has no VAPID key", async () => {
    installPushEnv();
    const result = await enablePush(
      fakeApi({ getVapidPublicKey: () => Promise.resolve(null) }),
      "x",
      cap,
    );
    expect(result).toBe("unconfigured");
    expect(saved.ctx).toBeUndefined();
  });

  it("pushEnabled is true only for the inbox the stored context belongs to", async () => {
    saved.ctx = { apiBase: "x", cap }; // cap.inboxId is this device's inbox
    expect(await pushEnabled(cap.inboxId)).toBe(true);
    expect(await pushEnabled("z".repeat(43))).toBe(false); // a different account
    expect(await pushEnabled(undefined)).toBe(false); // logged out
    saved.ctx = undefined;
    expect(await pushEnabled(cap.inboxId)).toBe(false);
  });

  it("disable unsubscribes and clears the worker context", async () => {
    const { sub } = installPushEnv();
    saved.ctx = { apiBase: "x", cap };
    await disablePush();
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
    expect(saved.ctx).toBeUndefined();
  });
});
