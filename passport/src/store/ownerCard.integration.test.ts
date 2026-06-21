// @vitest-environment node
// Badge derivation proven against a live blind store: an owner publishes from
// their state, changes state (a pause), republishes all aliases, and viewers see
// the new card on every link.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import {
  createBackendStore,
  publishCard,
  deriveAliasCard,
  republishOwnerCard,
} from "./index.ts";
import type { OwnerState } from "../core/badge.ts";
import { NOW_DAY, daysAgo } from "../core/badge.fixtures.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

const blue: OwnerState = {
  testing: {
    lastPanelDay: daysAgo(10),
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
  clearUntilDay: null,
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
    // Two public aliases, each published with its own per-alias card (the badge is
    // shared; the display identity is derived per alias, doc 15).
    const a = await publishCard(api, (rec) =>
      deriveAliasCard(blue, rec, NOW_DAY),
    );
    const b = await publishCard(api, (rec) =>
      deriveAliasCard(blue, rec, NOW_DAY),
    );
    const records: AliasRecord[] = [a.record, b.record];

    for (const r of records) {
      expect(await store.resolveAlias({ id: r.id, key: r.key })).toEqual(
        deriveAliasCard(blue, r, NOW_DAY),
      );
    }

    // The owner pauses: derive + republish every alias at once.
    const paused: OwnerState = { ...blue, paused: true };
    await republishOwnerCard(api, records, { state: paused, nowDay: NOW_DAY });

    for (const r of records) {
      const grayCard = deriveAliasCard(paused, r, NOW_DAY);
      expect(grayCard.state).toBe("gray");
      expect(await store.resolveAlias({ id: r.id, key: r.key })).toEqual(
        grayCard,
      );
    }
  });
});
