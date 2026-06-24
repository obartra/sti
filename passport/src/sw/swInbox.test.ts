// @vitest-environment node
import { describe, it, expect } from "vitest";
import { consumePartnerPing } from "./swInbox.ts";
import { mintNotify, writePing } from "../store/notifyInbox.ts";
import { encodePartnerPing } from "../store/partnerNotify.ts";
import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import { sha256Base64url, utf8ToBytes, type Bytes } from "../crypto/index.ts";

// In-memory /inbox like the blind server: a written id returns its payload, an
// unwritten id returns a stable id-seeded decoy (existence-uniform). putInbox
// enforces the write token. Only the inbox ops are exercised; the rest throw.
function fakeApi(): ApiClient {
  const inboxes = new Map<string, { payload: Bytes; auth: string }>();
  const unused = () => {
    throw new Error("not used in sw-inbox tests");
  };
  return {
    async getInbox(id) {
      const row = inboxes.get(id);
      if (row) return row.payload;
      const seed = await sha256Base64url(utf8ToBytes("decoy:" + id));
      const decoy = new Uint8Array(new ArrayBuffer(ALIAS_PAYLOAD_SIZE));
      for (let i = 0; i < decoy.length; i++) {
        decoy[i] = seed.charCodeAt(i % seed.length);
      }
      return decoy;
    },
    putInbox(id, payload, writeToken) {
      const row = inboxes.get(id);
      if (row && row.auth !== writeToken) {
        return Promise.reject(new Error("forbidden"));
      }
      const copy = new Uint8Array(new ArrayBuffer(payload.length));
      copy.set(payload);
      inboxes.set(id, { payload: copy, auth: writeToken });
      return Promise.resolve();
    },
    getAlias: unused,
    putAlias: unused,
    getAccount: unused,
    putAccount: unused,
    deleteAccount: unused,
    notify: unused,
    knock: unused,
    knockCount: unused,
    knockReview: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    resolveVanityName: unused,
    reportVanityName: unused,
    health: unused,
  };
}

describe("consumePartnerPing (service-worker wake core)", () => {
  it("returns true for a real ping, then clears it so a re-poll is false", async () => {
    const api = fakeApi();
    const cap = mintNotify();
    await writePing(api, cap, encodePartnerPing());

    expect(await consumePartnerPing(api, cap)).toBe(true);
    // Cleared: the next cover wake polls a non-ping decoy, so no repeat notify.
    expect(await consumePartnerPing(api, cap)).toBe(false);
  });

  it("returns false for a decoy inbox (a cover wake, never written)", async () => {
    const api = fakeApi();
    expect(await consumePartnerPing(api, mintNotify())).toBe(false);
  });

  it("returns false when the inbox holds a non-ping payload", async () => {
    const api = fakeApi();
    const cap = mintNotify();
    await writePing(api, cap, utf8ToBytes("not a ping"));
    expect(await consumePartnerPing(api, cap)).toBe(false);
  });
});
