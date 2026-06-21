// @vitest-environment node
// The full owner loop against a live blind store: create an account, publish the
// owner's card to an alias, then change the owner's state (a pause) and confirm
// every shared link flips to the new badge and the state survives recovery.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import {
  createAccountManager,
  createBackendStore,
  publishCard,
  deriveAliasCard,
} from "./index.ts";
import type { OwnerState } from "../core/badge.ts";
import { todayEpochDay } from "../core/clock.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

// This loop drives the real account manager, which republishes against the live
// clock (todayEpochDay), so the panel day is anchored to the real today too.
const TODAY = todayEpochDay();

const blue: OwnerState = {
  testing: {
    lastPanelDay: TODAY - 10,
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

describe("owner loop against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let accounts!: ReturnType<typeof createAccountManager>;
  let store!: ReturnType<typeof createBackendStore>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
    accounts = createAccountManager(api);
    store = createBackendStore(api);
  }, 120_000);

  afterAll(() => harness?.stop());

  it("create -> publish -> change state -> every link reflects the new badge", async () => {
    const created = await accounts.create("robin");
    await accounts.setOwnerState(created.master, blue);

    // Publish the owner's (blue) card to an alias and record it. The card's display
    // identity is derived per alias (doc 15), so resolution uses the record.
    const { record } = await publishCard(api, (rec) =>
      deriveAliasCard(blue, rec, TODAY),
    );
    await accounts.addAlias(created.master, record);
    expect(
      await store.resolveAlias({ id: record.id, key: record.key }),
    ).toEqual(deriveAliasCard(blue, record, TODAY));

    // The owner pauses: setOwnerState republishes every alias, re-sealing each with
    // its own per-alias identity and the new (gray) badge.
    const paused: OwnerState = { ...blue, paused: true };
    await accounts.setOwnerState(created.master, paused);

    const grayCard = deriveAliasCard(paused, record, TODAY);
    expect(grayCard.state).toBe("gray");
    expect(
      await store.resolveAlias({ id: record.id, key: record.key }),
    ).toEqual(grayCard);

    // The new state survives a fresh recovery.
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.state).toEqual(paused);
    expect(recovered?.blob.aliases).toEqual([record]);
  });
});
