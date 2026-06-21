// @vitest-environment node
// Knock proven against a live blind store: a knock on a real alias and on a
// nonexistent id both resolve the same way (existence-uniform), and a repeat
// knock from the same requester is accepted (deduped server-side).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { knock, publishCard } from "./index.ts";
import { randomAliasId } from "../crypto/index.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
import {
  startApi,
  randomHex,
  type Harness,
} from "../test-support/serverHarness.ts";

describe("knock against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
  }, 120_000);

  afterAll(() => harness?.stop());

  it("knocks on a real and a nonexistent alias the same way", async () => {
    const view: ResolvedView = {
      state: "gray",
      identity: { handle: "robin" },
    };
    const { record } = await publishCard(api, () => view, { isPublic: false });
    const secret = randomHex(16);

    await expect(knock(api, record.id, secret)).resolves.toBeUndefined();
    // A repeat from the same requester is fine (server dedupes).
    await expect(knock(api, record.id, secret)).resolves.toBeUndefined();
    // A nonexistent id resolves identically (no existence leak).
    await expect(knock(api, randomAliasId(), secret)).resolves.toBeUndefined();
  });
});
