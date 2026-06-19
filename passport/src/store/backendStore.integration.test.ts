// @vitest-environment node
// Public resolution proven against a live blind store: publish a card, resolve
// it back to the same ResolvedView, and confirm a miss or wrong key is an
// existence-uniform null. Shares the server harness with the api client test.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import { createBackendStore, serializePublicCard } from "./index.ts";
import {
  importAesKey,
  sealToSize,
  bytesToBase64url,
  randomAliasId,
  randomWriteToken,
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
});
