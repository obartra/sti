// @vitest-environment node
// Shared groups (doc 33) proven against a live blind store. The unit tests drive
// createGroup over a fake api that answers every call, so they cannot see the one
// thing only the real server enforces: a vanity claim is authorized by the write
// token of the alias the name points at, so the join pointer must already carry
// that capability when the claim lands. This builds + boots the real Go server and
// creates a public group through the real client.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { createAccountManager, createGroup } from "./index.ts";
import type { OwnerSession } from "./session.ts";
import {
  startApi,
  randomHex,
  type Harness,
} from "../test-support/serverHarness.ts";

describe("shared groups against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let accounts!: ReturnType<typeof createAccountManager>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
    accounts = createAccountManager(api);
  }, 120_000);

  afterAll(() => harness?.stop());

  async function freshSession(): Promise<OwnerSession> {
    const created = await accounts.create("robin");
    return { root: created.root, blob: created.blob };
  }

  it("creates a public group and claims its name to the join pointer", async () => {
    const session = await freshSession();
    const handle = `run_club_${randomHex(3)}`;

    const created = await createGroup(api, accounts, session, {
      handle,
      visibility: "public",
      meetingKind: "recurring",
    });

    expect(created.result).toBe("registered");
    const group = created.session.blob.groups?.find(
      (g) => g.groupId === created.groupId,
    );
    // The name resolves to the dedicated join pointer, never the group blob id.
    expect(group?.joinPointerId).toBeDefined();
    expect(group?.joinPointerId).not.toBe(created.groupId);
    expect(await api.resolveVanityName(handle)).toBe(group?.joinPointerId);
  });

  it("creates a private group with no name to claim", async () => {
    const session = await freshSession();
    const created = await createGroup(api, accounts, session, {
      handle: `book_club_${randomHex(3)}`,
      visibility: "private",
      meetingKind: "event",
    });

    expect(created.result).toBe("created");
    const group = created.session.blob.groups?.find(
      (g) => g.groupId === created.groupId,
    );
    expect(group?.joinPointerId).toBeUndefined();
  });
});
