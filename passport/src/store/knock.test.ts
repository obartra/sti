// @vitest-environment node
import { describe, it, expect } from "vitest";
import { knock, requesterHash } from "./knock.ts";
import type { ApiClient } from "../api/client.ts";

const ID = "A".repeat(43);

describe("requesterHash", () => {
  it("is a 43-char base64url, stable per (secret, id)", async () => {
    const a = await requesterHash("secret", ID);
    const b = await requesterHash("secret", ID);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).toBe(b);
  });

  it("differs by secret and by alias id", async () => {
    const base = await requesterHash("secret", ID);
    expect(await requesterHash("other", ID)).not.toBe(base);
    expect(await requesterHash("secret", "B".repeat(43))).not.toBe(base);
  });

  it("does not collide when a secret contains the separator", async () => {
    // ("a:b", "c") and ("a", "b:c") must not share a bucket.
    expect(await requesterHash("a:b", "c")).not.toBe(
      await requesterHash("a", "b:c"),
    );
  });
});

describe("knock", () => {
  it("posts the alias id with the derived requester hash", async () => {
    let seen: { id: string; hash: string } | undefined;
    const unused = () => {
      throw new Error("not used");
    };
    const api: ApiClient = {
      getAlias: unused,
      putAlias: unused,
      getAccount: unused,
      putAccount: unused,
      deleteAccount: unused,
      notify: unused,
      registerPush: unused,
      health: unused,
      knock: (id, hash) => {
        seen = { id, hash };
        return Promise.resolve();
      },
    };

    await knock(api, ID, "secret");
    expect(seen?.id).toBe(ID);
    expect(seen?.hash).toBe(await requesterHash("secret", ID));
  });
});
