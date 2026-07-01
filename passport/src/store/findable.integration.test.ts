// @vitest-environment node
// Findable (doc 17) proven against a live blind store: the full client<->server
// flow — claim a name for an owned alias, resolve it back, have the rules
// (reserved + the curated blocklist) reject, file a public report that reaches the
// admin queue, and release the name back into the lock. This is the end-to-end
// validation the unit tests (which use fakes) can't give: it builds + boots the
// real Go server and drives the real api client over HTTP.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { publishCard } from "./index.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
import { listAdminReports } from "../ui/admin/adminApi.ts";
import {
  startApi,
  randomHex,
  type Harness,
} from "../test-support/serverHarness.ts";

const ADMIN_TOKEN = randomHex(24); // 48 hex chars, over the 32-char boot floor

describe("Findable against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let baseUrl = "";
  // A unique name per run so a reused external instance never collides.
  const name = `robin_${randomHex(4)}`;

  beforeAll(async () => {
    harness = await startApi({
      env: {
        STI_ADMIN_ENABLED: "true",
        STI_ADMIN_TOKEN: ADMIN_TOKEN,
      },
    });
    baseUrl = harness.baseUrl;
    api = createApiClient(baseUrl);
  }, 120_000);

  afterAll(() => harness?.stop());

  // Mint a real public alias on the live server; its id + write token are what a
  // findable name binds to.
  async function publishAlias() {
    const view: ResolvedView = { state: "gray", identity: { handle: "robin" } };
    const { record } = await publishCard(api, () => view, { isPublic: true });
    return record;
  }

  it("claims a name, resolves it, and resolves an unknown name to null", async () => {
    const alias = await publishAlias();

    expect(await api.registerVanityName(name, alias.id, alias.writeToken)).toBe(
      "registered",
    );
    expect(await api.resolveVanityName(name)).toBe(alias.id);
    expect(await api.resolveVanityName(`nobody_${randomHex(4)}`)).toBeNull();
  });

  it("rejects a second claim, a reserved name, and a blocklisted name", async () => {
    const other = await publishAlias();

    // Already taken (claimed above) -> unavailable, even from a different alias.
    expect(await api.registerVanityName(name, other.id, other.writeToken)).toBe(
      "unavailable",
    );
    // Reserved operational term.
    expect(
      await api.registerVanityName("admin", other.id, other.writeToken),
    ).toBe("unavailable");
    // Curated hate blocklist is enforced end-to-end (proves the embedded list).
    expect(
      await api.registerVanityName("neonazi", other.id, other.writeToken),
    ).toBe("unavailable");
  });

  it("a public report reaches the admin review queue", async () => {
    await expect(
      api.reportVanityName(name, "impersonation"),
    ).resolves.toBeUndefined();

    const result = await listAdminReports(baseUrl, ADMIN_TOKEN);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const row = result.reports.find((r) => r.name === name);
    expect(row).toBeDefined();
    expect(row?.reason).toBe("impersonation");
  });

  it("releases the name so it stops resolving", async () => {
    const alias = await publishAlias();
    // Re-claim a fresh name we own, then release it.
    const mine = `sam_${randomHex(4)}`;
    expect(await api.registerVanityName(mine, alias.id, alias.writeToken)).toBe(
      "registered",
    );
    await expect(
      api.releaseVanityName(mine, alias.writeToken),
    ).resolves.toBeUndefined();
    expect(await api.resolveVanityName(mine)).toBeNull();
  });
});
