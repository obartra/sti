// @vitest-environment node
// Publishing proven against a live blind store: publish a card and resolve it
// back, then republish an update to the same alias and see the new card.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import {
  createBackendStore,
  publishCard,
  republishCard,
  parseAliasLink,
} from "./index.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

describe("publish against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let store!: ReturnType<typeof createBackendStore>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
    store = createBackendStore(api);
  }, 120_000);

  afterAll(() => harness?.stop());

  const blue: ResolvedView = {
    state: "blue",
    labels: ["hiv"],
    route: "hiv",
    identity: { handle: "robin" },
  };

  it("publishes a card that resolves back through its own link", async () => {
    const { link, record } = await publishCard(api, () => blue);

    // The returned link parses back to the record's id + key.
    const parsed = parseAliasLink(new URL(link).pathname, new URL(link).hash);
    expect(parsed).toEqual({ id: record.id, key: record.key });

    expect(
      await store.resolveAlias({ id: record.id, key: record.key }),
    ).toEqual(blue);
  });

  it("republishes an update to the same alias (link stays valid)", async () => {
    const { record } = await publishCard(api, () => blue);
    const gray: ResolvedView = { state: "gray", identity: { handle: "robin" } };

    await republishCard(api, record, gray);

    expect(
      await store.resolveAlias({ id: record.id, key: record.key }),
    ).toEqual({
      state: "gray",
      labels: [],
      route: null,
      identity: { handle: "robin" },
    });
  });
});
