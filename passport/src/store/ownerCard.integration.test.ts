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
    // A multi-alias republish is now a server-mediated decorrelation batch (doc 18):
    // the server applies each alias write at a jittered time off a queue, so the
    // owner's cards update via the janitor, not the request. No jitter window plus a
    // fast janitor makes the deferred apply observable within the test.
    harness = await startApi({
      env: { STI_REPUBLISH_WINDOW: "0", STI_JANITOR_INTERVAL: "120ms" },
    });
    api = createApiClient(harness.baseUrl);
    store = createBackendStore(api);
  }, 120_000);

  afterAll(() => harness?.stop());

  // Resolve an alias, retrying until it reaches the wanted state (the deferred
  // republish is applied by the background janitor, not synchronously).
  async function resolveWhenState(r: AliasRecord, want: string): Promise<void> {
    for (let i = 0; i < 60; i++) {
      const card = await store.resolveAlias({ id: r.id, key: r.key });
      if (card !== null && card.state === want) {
        expect(card).toEqual(
          deriveAliasCard({ ...blue, paused: true }, r, NOW_DAY),
        );
        return;
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    throw new Error(`alias ${r.id} never reached state ${want}`);
  }

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

    // The owner pauses: every alias is handed to the decorrelation batch and the
    // server applies each (here, with no jitter, on the next janitor pass).
    const paused: OwnerState = { ...blue, paused: true };
    expect(deriveAliasCard(paused, a.record, NOW_DAY).state).toBe("gray");
    await republishOwnerCard(api, records, { state: paused, nowDay: NOW_DAY });

    for (const r of records) {
      await resolveWhenState(r, "gray");
    }
  });
});
