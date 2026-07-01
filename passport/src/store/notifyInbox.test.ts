// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mintInbox, mintNotify, writePing, pollInbox } from "./notifyInbox.ts";
import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  sha256Base64url,
  utf8ToBytes,
  bytesToUtf8,
  type Bytes,
} from "../crypto/index.ts";

// A tiny in-memory /inbox: getInbox returns the stored payload or a stable
// id-seeded decoy (existence-uniform, like the blind server); putInbox enforces
// the write token. Only the inbox methods are exercised.
function fakeApi(): ApiClient {
  const inboxes = new Map<string, { payload: Bytes; auth: string }>();
  const unused = () => {
    throw new Error("not used in notify-inbox tests");
  };
  return {
    async getInbox(id): Promise<Bytes> {
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
        return Promise.reject(new Error("forbidden: wrong write token"));
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
    health: unused,
  };
}

describe("notify inbox channel", () => {
  it("mints distinct capabilities (id + token + key) each time", () => {
    const a = mintInbox();
    const b = mintInbox();
    expect(a.inboxId).not.toBe(b.inboxId);
    expect(a.writeToken).not.toBe(b.writeToken);
    expect(a.key).not.toBe(b.key);
  });

  it("mints distinct notify capabilities, ROUTING TOKEN included, each time", () => {
    // Per-contact decorrelation (doc 13): an owner mints one notify capability per
    // contact, so every field, the routing token too, must differ across two mints.
    // A shared/hoisted routing token would let a recipient holding two of the
    // owner's links tie them to one owner, which is the invariant this guards.
    const a = mintNotify();
    const b = mintNotify();
    expect(a.inboxId).not.toBe(b.inboxId);
    expect(a.writeToken).not.toBe(b.writeToken);
    expect(a.key).not.toBe(b.key);
    expect(a.routingToken).not.toBe(b.routingToken);
  });

  it("writes a ping and polls it back, decrypted", async () => {
    const api = fakeApi();
    const inbox = mintInbox();
    const ping = utf8ToBytes("get tested soon");
    await writePing(api, inbox, ping);
    const got = await pollInbox(api, inbox);
    if (got === null) throw new Error("expected a ping");
    expect(bytesToUtf8(got)).toBe("get tested soon");
  });

  it("a fresh inbox (a decoy, never written) polls to null", async () => {
    const api = fakeApi();
    expect(await pollInbox(api, mintInbox())).toBeNull();
  });

  it("the wrong key cannot read a ping (decrypt fails closed to null)", async () => {
    const api = fakeApi();
    const inbox = mintInbox();
    await writePing(api, inbox, utf8ToBytes("hi"));
    const wrong = { inboxId: inbox.inboxId, key: mintInbox().key };
    expect(await pollInbox(api, wrong)).toBeNull();
  });

  it("only the write-token holder can overwrite an inbox", async () => {
    const api = fakeApi();
    const inbox = mintInbox();
    await writePing(api, inbox, utf8ToBytes("first"));
    // A different writer (same id, different token) is rejected; writePing
    // surfaces that as a rejection, not a silent overwrite.
    const impostor = {
      inboxId: inbox.inboxId,
      writeToken: "nope",
      key: inbox.key,
    };
    await expect(
      writePing(api, impostor, utf8ToBytes("evil")),
    ).rejects.toThrow();
    // The original ping is intact.
    const still = await pollInbox(api, inbox);
    if (still === null)
      throw new Error("expected the original ping to survive");
    expect(bytesToUtf8(still)).toBe("first");
  });
});
