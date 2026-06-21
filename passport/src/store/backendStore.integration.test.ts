// @vitest-environment node
// Public resolution proven against a live blind store: publish a card, resolve
// it back to the same ResolvedView, and confirm a miss or wrong key is an
// existence-uniform null. Shares the server harness with the api client test.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  createBackendStore,
  serializePublicCard,
  grantAccess,
  redeemGrant,
  requesterHash,
  deriveGrantSlotId,
} from "./index.ts";
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
    await grantAccess(api, aliasRecord, pending);
    // Still exactly 4096 bytes once granted (no length tell vs the decoy).
    expect((await api.getAlias(slotId)).length).toBe(ALIAS_PAYLOAD_SIZE);

    // The requester redeems the alias key and resolves the real card with it.
    const redeemedKey = await redeemGrant(
      api,
      aliasId,
      requesterSecret,
      grantKeys.privateKey,
    );
    if (redeemedKey === null) throw new Error("expected a granted key");
    expect(await store.resolveAlias({ id: aliasId, key: redeemedKey })).toEqual(
      view,
    );
  });
});
