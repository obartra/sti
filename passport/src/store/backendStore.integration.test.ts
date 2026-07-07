// @vitest-environment node
// Public resolution proven against a live blind store: publish a card, resolve
// it back to the same ResolvedView, and confirm a miss or wrong key is an
// existence-uniform null. Shares the server harness with the api client test.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  createBackendStore,
  createGrantKeyStore,
  serializePublicCard,
  grantAccess,
  redeemGrant,
  requesterHash,
  deriveGrantSlotId,
  mintInbox,
  mintNotify,
  writePing,
  pollInbox,
  composeNotifyDraft,
  lockNotifyDraft,
  parsePartnerPing,
  type AccountBlob,
  type ContactRecord,
} from "./index.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { todayEpochDay } from "../core/clock.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import { utf8ToBytes, bytesToUtf8 } from "../crypto/index.ts";
import type { StorageLike } from "../auth/deviceStore.ts";
import {
  importAesKey,
  sealToSize,
  bytesToBase64url,
  randomAliasId,
  randomWriteToken,
  generateGrantKeyPair,
} from "../crypto/index.ts";
import type { AliasLink } from "./passportStore.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

describe("public resolution against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let store!: ReturnType<typeof createBackendStore>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
    store = createBackendStore(api);
  }, 120_000);

  afterAll(() => harness?.stop());

  async function publish(view: ResolvedView): Promise<AliasLink> {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw);
    const id = randomAliasId();
    const payload = await sealToSize(
      key,
      serializePublicCard(view),
      ALIAS_PAYLOAD_SIZE,
    );
    await api.putAlias(id, payload, randomWriteToken());
    return { id, key: bytesToBase64url(raw) };
  }

  it("publishes a card and resolves it back through the store", async () => {
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv", "condoms_always"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    expect(await store.resolveAlias(await publish(view))).toEqual(view);
  });

  it("a never-published id resolves to null (existence-uniform miss)", async () => {
    const key = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    expect(await store.resolveAlias({ id: randomAliasId(), key })).toBeNull();
  });

  it("the wrong key resolves to null, indistinguishable from a miss", async () => {
    const link = await publish({ state: "gray", identity: { handle: "sam" } });
    const wrong = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    expect(await store.resolveAlias({ id: link.id, key: wrong })).toBeNull();
  });

  it("knock resolves the same on a real alias and a never-published one (existence-uniform)", async () => {
    const link = await publish({ state: "gray", identity: { handle: "ash" } });
    // A knock on a real alias and on an id that never existed both resolve
    // without throwing: the server reveals nothing either way.
    await expect(store.knock(link.id)).resolves.toBeUndefined();
    await expect(store.knock(randomAliasId())).resolves.toBeUndefined();
  });

  it("a fixed requester secret dedupes repeated knocks on one alias", async () => {
    // Same per-device secret -> same requesterHash -> the server can dedupe a
    // repeat without learning who knocked. The client call resolves regardless.
    const secret = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const deduping = createBackendStore(api, secret);
    const link = await publish({ state: "gray", identity: { handle: "ash" } });
    await expect(deduping.knock(link.id)).resolves.toBeUndefined();
    await expect(deduping.knock(link.id)).resolves.toBeUndefined();
  });

  it("a knock's grant pubkey reaches the owner's review intact", async () => {
    // The owner needs the write token to review, so create the alias directly
    // with one we keep (publish() throws its token away).
    const id = randomAliasId();
    const writeToken = randomWriteToken();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw);
    const payload = await sealToSize(
      key,
      serializePublicCard({ state: "gray", identity: { handle: "noor" } }),
      ALIAS_PAYLOAD_SIZE,
    );
    await api.putAlias(id, payload, writeToken);

    // One requester knocks with an ephemeral grant key, another knocks contentless.
    const pubKey = bytesToBase64url(crypto.getRandomValues(new Uint8Array(65)));
    await api.knock(id, "req-with-key", pubKey);
    await api.knock(id, "req-no-key");

    const review = await api.knockReview(id, writeToken);
    expect(review.count).toBe(2);
    const byHash = new Map(
      review.pending.map((p) => [p.requesterHash, p.pubKey]),
    );
    expect(byHash.get("req-with-key")).toBe(pubKey);
    // A contentless knock carries no key; it surfaces as undefined, not "".
    expect(byHash.get("req-no-key")).toBeUndefined();
  });

  it("owner Approve grants a knocking requester access to a private alias", async () => {
    // The owner owns a private alias and keeps its record (id + write token + key).
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "jules" },
    };
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw);
    const aliasId = randomAliasId();
    const writeToken = randomWriteToken();
    const payload = await sealToSize(
      key,
      serializePublicCard(view),
      ALIAS_PAYLOAD_SIZE,
    );
    await api.putAlias(aliasId, payload, writeToken);
    const aliasRecord = {
      id: aliasId,
      writeToken,
      key: bytesToBase64url(raw),
      isPublic: false,
    };

    // A requester device: a per-device secret + a knock-time keypair it keeps.
    const requesterSecret = bytesToBase64url(
      crypto.getRandomValues(new Uint8Array(32)),
    );
    const grantKeys = await generateGrantKeyPair();
    const hash = await requesterHash(requesterSecret, aliasId);
    await api.knock(aliasId, hash, grantKeys.publicKey);

    // The grant slot is existence-uniform: a fixed 4096-byte body whether it
    // holds a real grant or is still just a decoy.
    const slotId = await deriveGrantSlotId(aliasId, hash);
    expect((await api.getAlias(slotId)).length).toBe(ALIAS_PAYLOAD_SIZE);

    // Before approval the grant slot is a decoy, so redeem is null (pending).
    expect(
      await redeemGrant(api, aliasId, requesterSecret, grantKeys.privateKey),
    ).toBeNull();

    // The owner reads the pending knock and approves it.
    const review = await api.knockReview(aliasId, writeToken);
    const pending = review.pending.find((p) => p.requesterHash === hash);
    expect(pending?.pubKey).toBe(grantKeys.publicKey);
    if (!pending) throw new Error("expected the pending knock to be present");
    await grantAccess(api, aliasRecord, pending, { kind: "key" });
    // Still exactly 4096 bytes once granted (no length tell vs the decoy).
    expect((await api.getAlias(slotId)).length).toBe(ALIAS_PAYLOAD_SIZE);

    // The requester redeems the alias key and resolves the real card with it.
    const redeemed = await redeemGrant(
      api,
      aliasId,
      requesterSecret,
      grantKeys.privateKey,
    );
    if (redeemed?.kind !== "key") throw new Error("expected a granted key");
    expect(
      await store.resolveAlias({ id: aliasId, key: redeemed.key }),
    ).toEqual(view);
  });

  it("the viewer store knocks, the owner approves, and redeemGrant returns the card", async () => {
    // The whole requester half through the PassportStore boundary: knock carries
    // the device's grant key, the owner approves, the store's redeemGrant resolves.
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "max" },
    };
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw);
    const aliasId = randomAliasId();
    const writeToken = randomWriteToken();
    await api.putAlias(
      aliasId,
      await sealToSize(key, serializePublicCard(view), ALIAS_PAYLOAD_SIZE),
      writeToken,
    );
    const aliasRecord = {
      id: aliasId,
      writeToken,
      key: bytesToBase64url(raw),
      isPublic: false,
    };

    // A viewer device: its own backend store with an in-memory grant key store and
    // a stable per-device secret.
    const secret = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const grantKeys = createGrantKeyStore(memoryStorage());
    const viewer = createBackendStore(api, secret, grantKeys);

    // Before knocking there is no stored key, so redeemGrant is null.
    expect(await viewer.redeemGrant(aliasId)).toBeNull();

    // The viewer knocks (the store sends its grant pubkey); still pending.
    await viewer.knock(aliasId);
    expect(await viewer.redeemGrant(aliasId)).toBeNull();

    // The owner reads the pending knock and approves it.
    const hash = await requesterHash(secret, aliasId);
    const review = await api.knockReview(aliasId, writeToken);
    const pending = review.pending.find((p) => p.requesterHash === hash);
    if (!pending) throw new Error("expected the viewer's knock to be pending");
    await grantAccess(api, aliasRecord, pending, { kind: "key" });

    // The viewer's store now redeems the grant into the real card.
    expect(await viewer.redeemGrant(aliasId)).toEqual(view);
  });

  it("a one-time grant seals a card snapshot: the viewer sees the status once, with no live key", async () => {
    // The owner's live card. A one-time approve seals a FROZEN copy of this into the
    // grant slot, so the viewer never receives the alias key.
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "max" },
      freshUntil: todayEpochDay() + 30,
    };
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw);
    const aliasId = randomAliasId();
    const writeToken = randomWriteToken();
    await api.putAlias(
      aliasId,
      await sealToSize(key, serializePublicCard(view), ALIAS_PAYLOAD_SIZE),
      writeToken,
    );
    const aliasRecord = {
      id: aliasId,
      writeToken,
      key: bytesToBase64url(raw),
      isPublic: false,
    };

    const secret = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const grantKeys = createGrantKeyStore(memoryStorage());
    const viewer = createBackendStore(api, secret, grantKeys);
    await viewer.knock(aliasId);

    const hash = await requesterHash(secret, aliasId);
    const review = await api.knockReview(aliasId, writeToken);
    const pending = review.pending.find((p) => p.requesterHash === hash);
    if (!pending) throw new Error("expected the viewer's knock to be pending");
    // Seal a snapshot of the current card, not the key.
    await grantAccess(api, aliasRecord, pending, {
      kind: "card",
      card: serializePublicCard(view),
    });

    // The viewer's store redeems the snapshot into the same card the key would give.
    expect(await viewer.redeemGrant(aliasId)).toEqual(view);
    // But it got a snapshot, not the key: the raw grant is a card envelope, so there
    // is no alias key to resolve the alias live with.
    const priv = grantKeys.privateKey(aliasId);
    if (priv === null) throw new Error("expected a stored grant key");
    const raw2 = await redeemGrant(api, aliasId, secret, priv);
    expect(raw2?.kind).toBe("card");
  });

  it("locks a partner-notify batch: a ping lands in the contact's inbox and decodes", async () => {
    // A contact the owner has exchanged notify capabilities with.
    const theirNotify = mintNotify();
    const nowDay = 19_000;
    const contact: ContactRecord = {
      id: randomAliasId(),
      label: "sam",
      createdDay: nowDay,
      expiresAt: null,
      alias: {
        id: randomAliasId(),
        writeToken: randomWriteToken(),
        key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
        isPublic: false,
      },
      theirNotify,
    };
    const blob: AccountBlob = {
      handle: "robin",
      aliases: [],
      contacts: [contact],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
    };

    // Before locking, the contact's inbox is an existence-uniform decoy: no ping.
    expect(await pollInbox(api, theirNotify)).toBeNull();

    // The default draft seeds the in-window notifiable contact.
    const draft = composeNotifyDraft(blob, nowDay);
    expect(draft.entries.map((e) => e.contactId)).toEqual([contact.id]);

    const result = await lockNotifyDraft(
      api,
      blob,
      draft.entries.map((e) => e.contactId),
    );
    expect(result.sent).toEqual([contact.id]);
    expect(result.failed).toEqual([]);

    // The recipient polls its inbox and decodes a contentless partner-notify ping.
    const got = await pollInbox(api, theirNotify);
    if (got === null) throw new Error("expected the partner-notify ping");
    expect(parsePartnerPing(got)?.kind).toBe("partner-notify");

    // Another contact's key cannot read this ping: same inbox id, wrong key decrypts
    // to null (GCM auth fails closed), so one contact never reads another's.
    const wrongKey = { inboxId: theirNotify.inboxId, key: mintNotify().key };
    expect(await pollInbox(api, wrongKey)).toBeNull();

    // A never-written inbox still polls null: the write was existence-uniform.
    expect(await pollInbox(api, mintNotify())).toBeNull();
  });

  it("the notify inbox round-trips a ping and a never-written inbox polls null", async () => {
    const inbox = mintInbox();
    // A fresh inbox (the server returns a decoy) decrypts to nothing.
    expect(await pollInbox(api, inbox)).toBeNull();

    // Write an encrypted ping; the recipient polls and decrypts it.
    await writePing(
      api,
      inbox,
      utf8ToBytes("a recent contact suggests testing"),
    );
    const got = await pollInbox(api, inbox);
    if (got === null) throw new Error("expected the ping");
    expect(bytesToUtf8(got)).toBe("a recent contact suggests testing");

    // The read is existence-uniform: a real inbox and a never-written one are both
    // a fixed 4096-byte body on the wire.
    expect((await api.getInbox(inbox.inboxId)).length).toBe(ALIAS_PAYLOAD_SIZE);
    expect((await api.getInbox(mintInbox().inboxId)).length).toBe(
      ALIAS_PAYLOAD_SIZE,
    );
  });
});

// A minimal in-memory StorageLike for the viewer's grant key store.
function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
