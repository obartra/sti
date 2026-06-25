// @vitest-environment node
import { describe, it, expect } from "vitest";
import { deriveGrantSlotId, grantAccess, redeemGrant } from "./grant.ts";
import { requesterHash } from "./knock.ts";
import type { AliasRecord } from "./accountBlob.ts";
import type { ApiClient, PendingKnock } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE, validId } from "../api/contract.ts";
import {
  generateGrantKeyPair,
  randomAliasId,
  randomWriteToken,
  bytesToBase64url,
  sha256Base64url,
  utf8ToBytes,
  type Bytes,
} from "../crypto/index.ts";

// A tiny in-memory /a store: enough of ApiClient for the grant path. getAlias
// returns a stable id-seeded decoy for a miss (existence-uniform, like the real
// server), and putAlias enforces the write token on overwrite.
function fakeApi(): ApiClient {
  const aliases = new Map<string, { payload: Bytes; auth: string }>();
  const unused = () => {
    throw new Error("not used in grant tests");
  };
  return {
    async getAlias(id): Promise<Bytes> {
      const row = aliases.get(id);
      if (row) return row.payload;
      // Deterministic decoy keyed by id, fixed size, like the blind server.
      const seed = await sha256Base64url(utf8ToBytes("decoy:" + id));
      const decoy = new Uint8Array(new ArrayBuffer(ALIAS_PAYLOAD_SIZE));
      for (let i = 0; i < decoy.length; i++) {
        decoy[i] = seed.charCodeAt(i % seed.length);
      }
      return decoy;
    },
    putAlias(id, payload, writeToken) {
      const row = aliases.get(id);
      if (row && row.auth !== writeToken) {
        return Promise.reject(new Error("forbidden: wrong write token"));
      }
      const copy = new Uint8Array(new ArrayBuffer(payload.length));
      copy.set(payload);
      aliases.set(id, { payload: copy, auth: writeToken });
      return Promise.resolve();
    },
    getAccount: unused,
    putAccount: unused,
    deleteAccount: unused,
    notify: unused,
    republish: unused,
    knock: unused,
    knockCount: unused,
    knockReview: unused,
    getInbox: unused,
    putInbox: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    resolveVanityName: unused,
    reportVanityName: unused,
    health: unused,
  };
}

function aliasRecord(): AliasRecord {
  return {
    id: randomAliasId(),
    writeToken: randomWriteToken(),
    key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
    isPublic: false,
  };
}

describe("grant slot id derivation", () => {
  it("is a valid opaque id and is deterministic for the same inputs", async () => {
    const id = await deriveGrantSlotId("alias-1", "req-1");
    expect(validId(id)).toBe(true);
    expect(await deriveGrantSlotId("alias-1", "req-1")).toBe(id);
  });

  it("differs across alias or requester (no cross-slot collision)", async () => {
    const base = await deriveGrantSlotId("alias-1", "req-1");
    expect(await deriveGrantSlotId("alias-2", "req-1")).not.toBe(base);
    expect(await deriveGrantSlotId("alias-1", "req-2")).not.toBe(base);
  });
});

describe("grantAccess / redeemGrant round trip", () => {
  it("the approved requester redeems exactly the alias read key", async () => {
    const api = fakeApi();
    const alias = aliasRecord();
    const secret = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const kp = await generateGrantKeyPair();
    const pending: PendingKnock = {
      requesterHash: await requesterHash(secret, alias.id),
      pubKey: kp.publicKey,
    };

    // Before approval the slot is a decoy, so redeem is null (still pending).
    expect(await redeemGrant(api, alias.id, secret, kp.privateKey)).toBeNull();

    await grantAccess(api, alias, pending);

    const redeemed = await redeemGrant(api, alias.id, secret, kp.privateKey);
    expect(redeemed).toBe(alias.key);
  });

  it("a different device's private key cannot redeem the grant", async () => {
    const api = fakeApi();
    const alias = aliasRecord();
    const secret = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const kp = await generateGrantKeyPair();
    await grantAccess(api, alias, {
      requesterHash: await requesterHash(secret, alias.id),
      pubKey: kp.publicKey,
    });

    const stranger = await generateGrantKeyPair();
    expect(
      await redeemGrant(api, alias.id, secret, stranger.privateKey),
    ).toBeNull();
  });

  it("re-approving overwrites the same slot in place (deterministic write token)", async () => {
    const api = fakeApi();
    const alias = aliasRecord();
    const secret = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const kp = await generateGrantKeyPair();
    const pending: PendingKnock = {
      requesterHash: await requesterHash(secret, alias.id),
      pubKey: kp.publicKey,
    };
    await grantAccess(api, alias, pending);
    // A second approve must not 403 on the existing slot.
    await expect(grantAccess(api, alias, pending)).resolves.toBeUndefined();
    expect(await redeemGrant(api, alias.id, secret, kp.privateKey)).toBe(
      alias.key,
    );
  });

  it("re-approving to a NEW key replaces the grant: the old key stops working", async () => {
    const api = fakeApi();
    const alias = aliasRecord();
    const secret = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const hash = await requesterHash(secret, alias.id);
    const kp1 = await generateGrantKeyPair();
    const kp2 = await generateGrantKeyPair();

    await grantAccess(api, alias, {
      requesterHash: hash,
      pubKey: kp1.publicKey,
    });
    expect(await redeemGrant(api, alias.id, secret, kp1.privateKey)).toBe(
      alias.key,
    );

    // Owner re-approves the same requester slot to a rotated key. The slot id and
    // write token are unchanged (both derive from the requesterHash), so this
    // overwrites in place; the old private key can no longer open it.
    await grantAccess(api, alias, {
      requesterHash: hash,
      pubKey: kp2.publicKey,
    });
    expect(await redeemGrant(api, alias.id, secret, kp1.privateKey)).toBeNull();
    expect(await redeemGrant(api, alias.id, secret, kp2.privateKey)).toBe(
      alias.key,
    );
  });

  it("throws if the pending knock carried no key to seal to", async () => {
    const api = fakeApi();
    const alias = aliasRecord();
    await expect(
      grantAccess(api, alias, { requesterHash: "r" }),
    ).rejects.toThrow();
  });
});
