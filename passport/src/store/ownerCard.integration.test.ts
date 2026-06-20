// @vitest-environment node
// Badge derivation proven against a live blind store: an owner publishes from
// their state, changes state (a pause), republishes all aliases, and viewers see
// the new card on every link.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import {
  createBackendStore,
  publishCard,
  deriveOwnerCard,
  republishOwnerCard,
} from "./index.ts";
import type { OwnerState } from "../core/badge.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

const blue: OwnerState = {
  testing: {
    hasEverTested: true,
    lastPanelAgeDays: 10,
    corePanelComplete: true,
    exposedSitesCovered: true,
  },
  hiv: "negative",
  activeNonHivSti: false,
  onPrep: true,
  condomPreference: "none",
  condomPreferencePublic: false,
  onDoxyPep: false,
  paused: false,
};

describe("badge derivation against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let store!: ReturnType<typeof createBackendStore>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
    store = createBackendStore(api);
  }, 120_000);

  afterAll(() => harness?.stop());

  it("republishes every alias when the owner's state changes to gray", async () => {
    // Two public aliases, both published with the owner's blue card.
    const blueCard = deriveOwnerCard(blue, "robin");
    const a = await publishCard(api, blueCard);
    const b = await publishCard(api, blueCard);
    const records: AliasRecord[] = [a.record, b.record];

    for (const r of records) {
      expect(await store.resolveAlias({ id: r.id, key: r.key })).toEqual(
        blueCard,
      );
    }

    // The owner pauses: derive + republish every alias at once.
    const paused: OwnerState = { ...blue, paused: true };
    await republishOwnerCard(api, records, paused, "robin");

    const grayCard = deriveOwnerCard(paused, "robin");
    expect(grayCard.state).toBe("gray");
    for (const r of records) {
      expect(await store.resolveAlias({ id: r.id, key: r.key })).toEqual(
        grayCard,
      );
    }
  });
});
