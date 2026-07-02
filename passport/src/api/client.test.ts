// @vitest-environment node
// Node gives us Response/Headers for building mock responses. These cover the
// error model and request wiring that the happy-path integration test cannot
// trigger (forbidden, rate-limited, shed, malformed responses).
import { describe, it, expect } from "vitest";
import { createApiClient, ApiError, type FetchLike } from "./client.ts";
import {
  ALIAS_PAYLOAD_SIZE,
  GROUP_BLOB_SIZE,
  HEADER_VERSION,
  HEADER_WRITE_TOKEN,
  RECOVERY_ENVELOPE_SIZE,
} from "./contract.ts";

const GOOD_ID = "A".repeat(43);
const BASE = "https://api.example";

interface Recorded {
  url: string;
  init: RequestInit | undefined;
}

/** A fetch that records the last call and returns a scripted response. */
function mockFetch(
  responder: (rec: Recorded) => Response | Promise<Response>,
): {
  fetch: FetchLike;
  last: () => Recorded;
} {
  let last: Recorded | undefined;
  const fetch: FetchLike = async (url, init) => {
    last = { url, init };
    return responder({ url, init });
  };
  return {
    fetch,
    last: () => {
      if (!last) throw new Error("fetch was not called");
      return last;
    },
  };
}

function aliasBody() {
  return new Uint8Array(ALIAS_PAYLOAD_SIZE);
}

describe("id validation", () => {
  it("rejects a malformed alias id before any network call", async () => {
    const m = mockFetch(() => new Response(null, { status: 200 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(api.getAlias("too-short")).rejects.toMatchObject({
      kind: "badRequest",
    });
  });
});

describe("error mapping", () => {
  const cases: readonly [number, string][] = [
    [429, "rateLimited"],
    [503, "unreachable"],
    [500, "server"],
  ];
  for (const [status, kind] of cases) {
    it(`maps HTTP ${status} to ${kind}`, async () => {
      const m = mockFetch(() => new Response(aliasBody(), { status }));
      const api = createApiClient(BASE, m.fetch);
      const err = await api.getAlias(GOOD_ID).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).kind).toBe(kind);
    });
  }

  it("maps a thrown fetch (network failure) to unreachable", async () => {
    const api = createApiClient(BASE, () =>
      Promise.reject(new Error("offline")),
    );
    await expect(api.getAlias(GOOD_ID)).rejects.toMatchObject({
      kind: "unreachable",
    });
  });

  it("flags a wrong-size alias body as a protocol error", async () => {
    const m = mockFetch(
      () => new Response(new Uint8Array(10), { status: 200 }),
    );
    const api = createApiClient(BASE, m.fetch);
    await expect(api.getAlias(GOOD_ID)).rejects.toMatchObject({
      kind: "protocol",
    });
  });
});

describe("alias write", () => {
  it("sends PUT with the write-token header and the payload", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await api.putAlias(GOOD_ID, aliasBody(), "tok123");
    const { url, init } = m.last();
    expect(url).toBe(`${BASE}/a/${GOOD_ID}`);
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get(HEADER_WRITE_TOKEN)).toBe("tok123");
  });

  it("maps 403 to forbidden (write-token mismatch)", async () => {
    const m = mockFetch(() => new Response(null, { status: 403 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putAlias(GOOD_ID, aliasBody(), "bad"),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("refuses to send a wrong-size payload", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putAlias(GOOD_ID, new Uint8Array(5), "tok"),
    ).rejects.toMatchObject({ kind: "protocol" });
  });
});

describe("notify inbox", () => {
  it("GET/PUT use the /inbox path with the same fixed-size + token rules", async () => {
    const m = mockFetch(
      () => new Response(new Uint8Array(ALIAS_PAYLOAD_SIZE), { status: 200 }),
    );
    const api = createApiClient(BASE, m.fetch);

    const body = await api.getInbox(GOOD_ID);
    expect(m.last().url).toBe(`${BASE}/inbox/${GOOD_ID}`);
    expect(body.length).toBe(ALIAS_PAYLOAD_SIZE);

    await api.putInbox(GOOD_ID, aliasBody(), "inbox-tok");
    expect(m.last().url).toBe(`${BASE}/inbox/${GOOD_ID}`);
    expect(m.last().init?.method).toBe("PUT");
    expect(new Headers(m.last().init?.headers).get(HEADER_WRITE_TOKEN)).toBe(
      "inbox-tok",
    );
  });

  it("a wrong-size inbox payload is a protocol error, and 403 is forbidden", async () => {
    const ok = createApiClient(
      BASE,
      mockFetch(() => new Response(null, { status: 204 })).fetch,
    );
    await expect(
      ok.putInbox(GOOD_ID, new Uint8Array(5), "tok"),
    ).rejects.toMatchObject({ kind: "protocol" });

    const denied = createApiClient(
      BASE,
      mockFetch(() => new Response(null, { status: 403 })).fetch,
    );
    await expect(
      denied.putInbox(GOOD_ID, aliasBody(), "bad"),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });
});

describe("account sync", () => {
  it("returns null on 404 (no blob yet), not an error", async () => {
    const m = mockFetch(() => new Response(null, { status: 404 }));
    const api = createApiClient(BASE, m.fetch);
    expect(await api.getAccount(GOOD_ID)).toBeNull();
  });

  it("returns blob plus version from the version header", async () => {
    const m = mockFetch(
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { [HEADER_VERSION]: "7" },
        }),
    );
    const api = createApiClient(BASE, m.fetch);
    const got = await api.getAccount(GOOD_ID);
    expect(got?.version).toBe("7");
    expect(got?.blob).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("treats a missing version header as a protocol error", async () => {
    const m = mockFetch(
      () => new Response(new Uint8Array([1]), { status: 200 }),
    );
    const api = createApiClient(BASE, m.fetch);
    await expect(api.getAccount(GOOD_ID)).rejects.toMatchObject({
      kind: "protocol",
    });
  });

  it("sends the write token, and ifVersion as the version header when provided", async () => {
    const m = mockFetch(
      () =>
        new Response(null, { status: 204, headers: { [HEADER_VERSION]: "8" } }),
    );
    const api = createApiClient(BASE, m.fetch);
    const res = await api.putAccount(GOOD_ID, new Uint8Array([9]), "wt", "7");
    expect(res.version).toBe("8");
    const sent = new Headers(m.last().init?.headers);
    expect(sent.get(HEADER_VERSION)).toBe("7");
    expect(sent.get(HEADER_WRITE_TOKEN)).toBe("wt");
  });

  it("maps 413 to tooLarge", async () => {
    const m = mockFetch(() => new Response(null, { status: 413 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putAccount(GOOD_ID, new Uint8Array(1), "wt"),
    ).rejects.toMatchObject({ kind: "tooLarge" });
  });

  it("maps 409 to conflict (a stale optimistic-concurrency version)", async () => {
    const m = mockFetch(() => new Response(null, { status: 409 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putAccount(GOOD_ID, new Uint8Array(1), "wt", "3"),
    ).rejects.toMatchObject({ kind: "conflict" });
  });
});

describe("notify, knock, health", () => {
  it("posts notify with the token hash in the body", async () => {
    const m = mockFetch(() => new Response(null, { status: 202 }));
    const api = createApiClient(BASE, m.fetch);
    await api.notify("hash123");
    expect(m.last().init?.body).toBe(JSON.stringify({ tokenHash: "hash123" }));
  });

  it("posts knock to the id with the requester hash", async () => {
    const m = mockFetch(
      () =>
        new Response(JSON.stringify({ status: "received" }), { status: 200 }),
    );
    const api = createApiClient(BASE, m.fetch);
    await api.knock(GOOD_ID, "req123");
    expect(m.last().url).toBe(`${BASE}/knock/${GOOD_ID}`);
    expect(m.last().init?.body).toBe(
      JSON.stringify({ requesterHash: "req123" }),
    );
  });

  it("includes the grant pubkey in the knock body when given, omits it otherwise", async () => {
    const m = mockFetch(
      () =>
        new Response(JSON.stringify({ status: "received" }), { status: 200 }),
    );
    const api = createApiClient(BASE, m.fetch);
    await api.knock(GOOD_ID, "req123", "ephemeralPub");
    expect(m.last().init?.body).toBe(
      JSON.stringify({ requesterHash: "req123", pubKey: "ephemeralPub" }),
    );
    // No pubKey -> the legacy, contentless body shape (no empty field).
    await api.knock(GOOD_ID, "req123");
    expect(m.last().init?.body).toBe(
      JSON.stringify({ requesterHash: "req123" }),
    );
  });

  it("knockReview returns count + pending and keeps only well-formed entries", async () => {
    const m = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            count: 2,
            pending: [
              { requesterHash: "ra", pubKey: "ka" },
              { requesterHash: "rb" }, // contentless knock: no key
              { pubKey: "orphan" }, // malformed: dropped
            ],
          }),
          { status: 200 },
        ),
    );
    const api = createApiClient(BASE, m.fetch);
    const review = await api.knockReview(GOOD_ID, "owner-token");
    expect(m.last().init?.headers).toMatchObject({
      [HEADER_WRITE_TOKEN]: "owner-token",
    });
    expect(review.count).toBe(2);
    expect(review.pending).toEqual([
      { requesterHash: "ra", pubKey: "ka" },
      { requesterHash: "rb" },
    ]);
  });

  it("knockCount delegates to the review and an older count-only body still parses", async () => {
    const m = mockFetch(
      () => new Response(JSON.stringify({ count: 3 }), { status: 200 }),
    );
    const api = createApiClient(BASE, m.fetch);
    expect(await api.knockCount(GOOD_ID, "owner-token")).toBe(3);
    // A review on the same count-only body degrades pending to an empty list.
    expect((await api.knockReview(GOOD_ID, "owner-token")).pending).toEqual([]);
  });

  it("health reflects res.ok and is false (not a rejection) when unreachable", async () => {
    const ok = createApiClient(BASE, () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    const down = createApiClient(BASE, () =>
      Promise.resolve(new Response(null, { status: 500 })),
    );
    const unreachable = createApiClient(BASE, () =>
      Promise.reject(new Error("connection refused")),
    );
    expect(await ok.health()).toBe(true);
    expect(await down.health()).toBe(false);
    expect(await unreachable.health()).toBe(false);
  });
});

describe("vanity name (Findable, doc 17)", () => {
  const resp = (status: number, body?: string) => () =>
    Promise.resolve(new Response(body ?? null, { status }));

  it("registerVanityName PUTs name->aliasId with the write token and maps outcomes", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(api.registerVanityName("robin", GOOD_ID, "wt")).resolves.toBe(
      "registered",
    );
    const { url, init } = m.last();
    expect(url).toBe(BASE + "/u/robin");
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Record<string, string>)[HEADER_WRITE_TOKEN]).toBe(
      "wt",
    );
    expect(JSON.parse(init?.body as string)).toEqual({ aliasId: GOOD_ID });

    expect(
      await createApiClient(BASE, resp(409)).registerVanityName(
        "robin",
        GOOD_ID,
        "wt",
      ),
    ).toBe("unavailable");
    for (const status of [400, 403, 500]) {
      expect(
        await createApiClient(BASE, resp(status)).registerVanityName(
          "robin",
          GOOD_ID,
          "wt",
        ),
      ).toBe("error");
    }
  });

  it("releaseVanityName DELETEs, is idempotent on 204/404, throws otherwise", async () => {
    for (const status of [204, 404]) {
      const m = mockFetch(() => new Response(null, { status }));
      const api = createApiClient(BASE, m.fetch);
      await expect(
        api.releaseVanityName("robin", "wt"),
      ).resolves.toBeUndefined();
      expect(m.last().init?.method).toBe("DELETE");
    }
    await expect(
      createApiClient(BASE, resp(500)).releaseVanityName("robin", "wt"),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("resolveVanityName returns the alias id, or null on 404", async () => {
    expect(
      await createApiClient(
        BASE,
        resp(200, JSON.stringify({ aliasId: GOOD_ID })),
      ).resolveVanityName("robin"),
    ).toBe(GOOD_ID);
    expect(
      await createApiClient(BASE, resp(404)).resolveVanityName("nobody"),
    ).toBeNull();
    // A malformed id from the server is treated as unresolvable (validated).
    expect(
      await createApiClient(
        BASE,
        resp(200, JSON.stringify({ aliasId: "too-short" })),
      ).resolveVanityName("robin"),
    ).toBeNull();
    await expect(
      createApiClient(BASE, resp(500)).resolveVanityName("robin"),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("reportVanityName (Findable report, doc 17)", () => {
  it("POSTs the reason to /u/{name}/report and resolves on 202", async () => {
    const m = mockFetch(() => new Response(null, { status: 202 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.reportVanityName("rob1n", "slur"),
    ).resolves.toBeUndefined();
    const { url, init } = m.last();
    expect(url).toBe(BASE + "/u/rob1n/report");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ reason: "slur" });
  });

  it("throws on a non-202 response", async () => {
    const bad = createApiClient(BASE, () =>
      Promise.resolve(new Response(null, { status: 400 })),
    );
    await expect(bad.reportVanityName("rob1n", "spam")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("recovery envelope", () => {
  const envelope = () => new Uint8Array(RECOVERY_ENVELOPE_SIZE).fill(7);

  it("fetches the fixed-size body from the URL-encoded locator", async () => {
    const m = mockFetch(() => new Response(envelope(), { status: 200 }));
    const api = createApiClient(BASE, m.fetch);
    const body = await api.getRecoveryEnvelope("me ow");
    expect(body).toHaveLength(RECOVERY_ENVELOPE_SIZE);
    expect(m.last().url).toBe(BASE + "/recovery/me%20ow");
    expect(m.last().init?.method).toBe("GET");
  });

  it("rejects a wrong-size fetched body as a protocol error", async () => {
    const api = createApiClient(BASE, () =>
      Promise.resolve(new Response(new Uint8Array(10), { status: 200 })),
    );
    await expect(api.getRecoveryEnvelope("meow")).rejects.toMatchObject({
      kind: "protocol",
    });
  });

  it("puts the envelope with the write token and the fixed size", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putRecoveryEnvelope("meow", envelope(), "acct-token"),
    ).resolves.toBeUndefined();
    const { url, init } = m.last();
    expect(url).toBe(BASE + "/recovery/meow");
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Record<string, string>)[HEADER_WRITE_TOKEN]).toBe(
      "acct-token",
    );
  });

  it("refuses to put a wrong-size envelope before the wire", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putRecoveryEnvelope("meow", new Uint8Array(5), "t"),
    ).rejects.toMatchObject({ kind: "protocol" });
  });

  it("deletes with the write token", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.deleteRecoveryEnvelope("meow", "acct-token"),
    ).resolves.toBeUndefined();
    expect(m.last().init?.method).toBe("DELETE");
  });

  it("maps a rate-limited fetch to the typed error", async () => {
    const api = createApiClient(BASE, () =>
      Promise.resolve(new Response(null, { status: 429 })),
    );
    await expect(api.getRecoveryEnvelope("meow")).rejects.toMatchObject({
      kind: "rateLimited",
    });
  });
});

describe("group blob", () => {
  const blob = () => new Uint8Array(GROUP_BLOB_SIZE).fill(9);

  it("fetches the fixed-size body from the group id", async () => {
    const m = mockFetch(() => new Response(blob(), { status: 200 }));
    const api = createApiClient(BASE, m.fetch);
    const body = await api.getGroupBlob(GOOD_ID);
    expect(body).toHaveLength(GROUP_BLOB_SIZE);
    expect(m.last().url).toBe(BASE + "/g/" + GOOD_ID);
    expect(m.last().init?.method).toBe("GET");
  });

  it("rejects a malformed group id before any network call", async () => {
    const m = mockFetch(() => new Response(blob(), { status: 200 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(api.getGroupBlob("too-short")).rejects.toMatchObject({
      kind: "badRequest",
    });
  });

  it("rejects a wrong-size fetched body as a protocol error", async () => {
    const api = createApiClient(BASE, () =>
      Promise.resolve(new Response(new Uint8Array(10), { status: 200 })),
    );
    await expect(api.getGroupBlob(GOOD_ID)).rejects.toMatchObject({
      kind: "protocol",
    });
  });

  it("puts the blob with the write token and the fixed size", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putGroupBlob(GOOD_ID, blob(), "admin-token"),
    ).resolves.toBeUndefined();
    const { url, init } = m.last();
    expect(url).toBe(BASE + "/g/" + GOOD_ID);
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Record<string, string>)[HEADER_WRITE_TOKEN]).toBe(
      "admin-token",
    );
  });

  it("refuses to put a wrong-size blob before the wire", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putGroupBlob(GOOD_ID, new Uint8Array(5), "t"),
    ).rejects.toMatchObject({ kind: "protocol" });
  });

  it("maps a wrong-token put (403) to the forbidden error", async () => {
    const api = createApiClient(BASE, () =>
      Promise.resolve(new Response(null, { status: 403 })),
    );
    await expect(
      api.putGroupBlob(GOOD_ID, blob(), "not-owner"),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("deletes with the write token", async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.deleteGroupBlob(GOOD_ID, "admin-token"),
    ).resolves.toBeUndefined();
    expect(m.last().init?.method).toBe("DELETE");
  });
});
