// @vitest-environment node
// Node gives us Response/Headers for building mock responses. These cover the
// error model and request wiring that the happy-path integration test cannot
// trigger (forbidden, rate-limited, shed, malformed responses).
import { describe, it, expect } from "vitest";
import { createApiClient, ApiError, type FetchLike } from "./client.ts";
import {
  ALIAS_PAYLOAD_SIZE,
  HEADER_VERSION,
  HEADER_WRITE_TOKEN,
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

  it("sends ifVersion as the version header when provided", async () => {
    const m = mockFetch(
      () =>
        new Response(null, { status: 204, headers: { [HEADER_VERSION]: "8" } }),
    );
    const api = createApiClient(BASE, m.fetch);
    const res = await api.putAccount(GOOD_ID, new Uint8Array([9]), "7");
    expect(res.version).toBe("8");
    expect(new Headers(m.last().init?.headers).get(HEADER_VERSION)).toBe("7");
  });

  it("maps 413 to tooLarge", async () => {
    const m = mockFetch(() => new Response(null, { status: 413 }));
    const api = createApiClient(BASE, m.fetch);
    await expect(
      api.putAccount(GOOD_ID, new Uint8Array(1)),
    ).rejects.toMatchObject({ kind: "tooLarge" });
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
