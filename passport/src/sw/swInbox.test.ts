// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { consumePartnerPing } from "./swInbox.ts";
import { mintNotify, writePing } from "../store/notifyInbox.ts";
import { encodePartnerPing } from "../store/partnerNotify.ts";
import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import { sha256Base64url, utf8ToBytes, type Bytes } from "../crypto/index.ts";

// In-memory /inbox like the blind server: a written id returns its payload, an
// unwritten id returns a stable id-seeded decoy (existence-uniform). putInbox
// enforces the write token and COUNTS its calls, so a test can assert the recipient
// poll path performs no write. Only the inbox ops are exercised; the rest throw.
function fakeApi(): { api: ApiClient; putCount: () => number } {
  const inboxes = new Map<string, { payload: Bytes; auth: string }>();
  let puts = 0;
  const unused = () => {
    throw new Error("not used in sw-inbox tests");
  };
  const api: ApiClient = {
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
      puts++;
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
    republish: unused,
    knock: unused,
    knockCount: unused,
    knockReview: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    resolveVanityName: unused,
    reportVanityName: unused,
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    getGroupBlob: unused,
    putGroupBlob: unused,
    deleteGroupBlob: unused,
    health: unused,
  };
  return { api, putCount: () => puts };
}

// The device-local consumed-nonce store persists in (fake) IndexedDB across tests in
// this file; wipe it before each so a case starts from a clean dedup state.
beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("sti-consumed-pings");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("consumePartnerPing (service-worker wake core)", () => {
  it("notifies once for a real ping and performs NO inbox write", async () => {
    const { api, putCount } = fakeApi();
    const cap = mintNotify();
    await writePing(api, cap, encodePartnerPing()); // one write, by the SENDER
    const writesAfterSetup = putCount();

    expect(await consumePartnerPing(api, cap)).toBe(true);
    // The recipient path is read-only: no clear-write, no read-marker. This is the
    // whole point, so the server sees no recipient-identifying write after a wake.
    expect(putCount()).toBe(writesAfterSetup);
  });

  it("does not re-notify (or write) on a re-poll of the same ping", async () => {
    const { api, putCount } = fakeApi();
    const cap = mintNotify();
    await writePing(api, cap, encodePartnerPing());
    const writesAfterSetup = putCount();

    expect(await consumePartnerPing(api, cap)).toBe(true);
    // Same (inboxId, nonce): device-local dedup suppresses the repeat, still no write.
    expect(await consumePartnerPing(api, cap)).toBe(false);
    expect(putCount()).toBe(writesAfterSetup);
  });

  it("notifies again for a NEW nonce at the same inbox", async () => {
    const { api } = fakeApi();
    const cap = mintNotify();

    await writePing(api, cap, encodePartnerPing());
    expect(await consumePartnerPing(api, cap)).toBe(true);
    expect(await consumePartnerPing(api, cap)).toBe(false);

    // A later report writes a fresh ping (a new nonce) to the same inbox: a genuinely
    // new nudge, so it notifies again.
    await writePing(api, cap, encodePartnerPing());
    expect(await consumePartnerPing(api, cap)).toBe(true);
  });

  it("returns false for a decoy inbox (a cover wake, never written)", async () => {
    const { api } = fakeApi();
    expect(await consumePartnerPing(api, mintNotify())).toBe(false);
  });

  it("returns false when the inbox holds a non-ping payload", async () => {
    const { api } = fakeApi();
    const cap = mintNotify();
    await writePing(api, cap, utf8ToBytes("not a ping"));
    expect(await consumePartnerPing(api, cap)).toBe(false);
  });
});
