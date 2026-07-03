import { describe, it, expect, vi } from "vitest";
import {
  actOnVanityName,
  disableAccount,
  getAdminHealth,
  getAdminMetrics,
  getAdminTrends,
  listAdminAudit,
  listAdminFeedback,
  listAdminReports,
  lookupRecord,
  pingAdmin,
  resolveFeedback,
  revokeAlias,
  type FetchLike,
} from "./adminApi.ts";

function resp(status: number): Response {
  return new Response(null, { status });
}

describe("pingAdmin", () => {
  it("sends the bearer in the Authorization header, never the URL", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(resp(204));
    const result = await pingAdmin("https://api.example", "s3cret", fetchImpl);

    expect(result).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example/admin/ping",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer s3cret" },
      }),
    );
    // The secret rides the header only, never the URL.
    expect(fetchImpl.mock.calls.every(([url]) => !url.includes("s3cret"))).toBe(
      true,
    );
  });

  it("maps 401 to unauthorized", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(resp(401));
    expect(await pingAdmin("https://api.example", "bad", fetchImpl)).toBe(
      "unauthorized",
    );
  });

  it("maps any other status to a generic error", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(resp(500));
    expect(await pingAdmin("https://api.example", "t", fetchImpl)).toBe(
      "error",
    );
  });

  it("maps a network failure to a generic error, not unauthorized", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockRejectedValue(new Error("offline"));
    expect(await pingAdmin("https://api.example", "t", fetchImpl)).toBe(
      "error",
    );
  });
});

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("listAdminReports", () => {
  it("returns the reports on 200, defaulting a missing array to empty", async () => {
    const reports = [{ name: "robin", reason: "spam", count: 2, createdAt: 5 }];
    const ok = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, { reports }));
    expect(await listAdminReports("https://api.example", "t", ok)).toEqual({
      kind: "ok",
      reports,
    });
    expect(ok).toHaveBeenCalledWith(
      "https://api.example/admin/reports",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer t" },
      }),
    );

    const noField = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, {}));
    expect(await listAdminReports("https://api.example", "t", noField)).toEqual(
      {
        kind: "ok",
        reports: [],
      },
    );
  });

  it("maps 401 to unauthorized and other failures to error", async () => {
    const codes: [number, "unauthorized" | "error"][] = [
      [401, "unauthorized"],
      [500, "error"],
    ];
    for (const [status, kind] of codes) {
      const f = vi.fn<FetchLike>().mockResolvedValue(jsonResp(status, {}));
      expect((await listAdminReports("https://api.example", "t", f)).kind).toBe(
        kind,
      );
    }
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      (await listAdminReports("https://api.example", "t", netDown)).kind,
    ).toBe("error");
    const badBody = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    expect(
      (await listAdminReports("https://api.example", "t", badBody)).kind,
    ).toBe("error");
  });
});

describe("getAdminMetrics", () => {
  it("returns the metrics on 200, defaulting missing fields to 0", async () => {
    const metrics = {
      accounts: 12,
      aliases: 34,
      knocks: 5,
      sendQueueDepth: 1,
      dbSizeBytes: 4096,
      pendingReports: 2,
      pendingFeedback: 8,
    };
    const ok = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, metrics));
    expect(await getAdminMetrics("https://api.example", "t", ok)).toEqual({
      kind: "ok",
      metrics,
    });
    expect(ok).toHaveBeenCalledWith(
      "https://api.example/admin/metrics",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer t" },
      }),
    );

    // A partial body fills the absent counts with 0 (never NaN in the UI).
    const partial = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResp(200, { accounts: 7 }));
    expect(await getAdminMetrics("https://api.example", "t", partial)).toEqual({
      kind: "ok",
      metrics: {
        accounts: 7,
        aliases: 0,
        knocks: 0,
        sendQueueDepth: 0,
        dbSizeBytes: 0,
        pendingReports: 0,
        pendingFeedback: 0,
      },
    });
  });

  it("maps 401 to unauthorized and other failures to error", async () => {
    const codes: [number, "unauthorized" | "error"][] = [
      [401, "unauthorized"],
      [503, "error"],
    ];
    for (const [status, kind] of codes) {
      const f = vi.fn<FetchLike>().mockResolvedValue(jsonResp(status, {}));
      expect((await getAdminMetrics("https://api.example", "t", f)).kind).toBe(
        kind,
      );
    }
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      (await getAdminMetrics("https://api.example", "t", netDown)).kind,
    ).toBe("error");
    const badBody = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    expect(
      (await getAdminMetrics("https://api.example", "t", badBody)).kind,
    ).toBe("error");
  });
});

describe("getAdminHealth", () => {
  it("returns the health snapshot on 200, defaulting missing fields", async () => {
    const health = {
      errors: [
        { type: "store", count: 2 },
        { type: "decode", count: 1 },
      ],
      sendQueueDepth: 3,
      sendQueueOldestAgeSeconds: 42,
      janitorAgeSeconds: 12,
      inflightCurrent: 1,
      inflightMax: 64,
    };
    const ok = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, health));
    expect(await getAdminHealth("https://api.example", "t", ok)).toEqual({
      kind: "ok",
      health,
    });
    expect(ok).toHaveBeenCalledWith(
      "https://api.example/admin/health",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer t" },
      }),
    );

    // A partial body fills the absent fields: errors to empty, counts/ages to 0, and
    // the heartbeat age to the -1 "never ran" flag (never NaN in the UI).
    const partial = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResp(200, { sendQueueDepth: 5 }));
    expect(await getAdminHealth("https://api.example", "t", partial)).toEqual({
      kind: "ok",
      health: {
        errors: [],
        sendQueueDepth: 5,
        sendQueueOldestAgeSeconds: 0,
        janitorAgeSeconds: -1,
        inflightCurrent: 0,
        inflightMax: 0,
      },
    });
  });

  it("maps 401 to unauthorized and other failures to error", async () => {
    const codes: [number, "unauthorized" | "error"][] = [
      [401, "unauthorized"],
      [503, "error"],
    ];
    for (const [status, kind] of codes) {
      const f = vi.fn<FetchLike>().mockResolvedValue(jsonResp(status, {}));
      expect((await getAdminHealth("https://api.example", "t", f)).kind).toBe(
        kind,
      );
    }
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      (await getAdminHealth("https://api.example", "t", netDown)).kind,
    ).toBe("error");
    const badBody = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    expect(
      (await getAdminHealth("https://api.example", "t", badBody)).kind,
    ).toBe("error");
  });
});

describe("getAdminTrends", () => {
  it("returns the trends on 200 and requests the window in the URL", async () => {
    const trends = {
      reportsPerDay: [{ day: 20630, count: 4 }],
      signupsPerDay: [{ day: 20630, count: 9 }],
      reviewLatency: [{ underMs: 3600000, count: 2 }],
    };
    const ok = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, trends));
    expect(await getAdminTrends("https://api.example", "t", 30, ok)).toEqual({
      kind: "ok",
      trends,
    });
    expect(ok).toHaveBeenCalledWith(
      "https://api.example/admin/trends?days=30",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer t" },
      }),
    );

    // A partial body fills the absent series with an empty array (never undefined).
    const partial = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        jsonResp(200, { reportsPerDay: [{ day: 1, count: 1 }] }),
      );
    expect(
      await getAdminTrends("https://api.example", "t", 7, partial),
    ).toEqual({
      kind: "ok",
      trends: {
        reportsPerDay: [{ day: 1, count: 1 }],
        signupsPerDay: [],
        reviewLatency: [],
      },
    });
  });

  it("maps 401 to unauthorized and other failures to error", async () => {
    const codes: [number, "unauthorized" | "error"][] = [
      [401, "unauthorized"],
      [503, "error"],
    ];
    for (const [status, kind] of codes) {
      const f = vi.fn<FetchLike>().mockResolvedValue(jsonResp(status, {}));
      expect(
        (await getAdminTrends("https://api.example", "t", 30, f)).kind,
      ).toBe(kind);
    }
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      (await getAdminTrends("https://api.example", "t", 30, netDown)).kind,
    ).toBe("error");
    const badBody = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    expect(
      (await getAdminTrends("https://api.example", "t", 30, badBody)).kind,
    ).toBe("error");
  });
});

describe("listAdminAudit", () => {
  it("returns the entries on 200, requests a page, defaulting a missing array to empty", async () => {
    const entries = [
      { id: 5, action: "vanity.takedown", target: "robin", createdAt: 5 },
    ];
    const ok = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, { entries }));
    expect(await listAdminAudit("https://api.example", "t", 0, ok)).toEqual({
      kind: "ok",
      entries,
    });
    // First page requests the page size, no cursor, bearer in the header only.
    expect(ok).toHaveBeenCalledWith(
      "https://api.example/admin/audit?limit=50",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer t" },
      }),
    );

    const noField = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, {}));
    expect(
      await listAdminAudit("https://api.example", "t", 0, noField),
    ).toEqual({ kind: "ok", entries: [] });
  });

  it("passes a non-zero cursor as ?before for older pages", async () => {
    const ok = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResp(200, { entries: [] }));
    await listAdminAudit("https://api.example", "t", 42, ok);
    expect(ok.mock.calls[0]?.[0]).toBe(
      "https://api.example/admin/audit?limit=50&before=42",
    );
  });

  it("maps 401 to unauthorized and other failures to error", async () => {
    const codes: [number, "unauthorized" | "error"][] = [
      [401, "unauthorized"],
      [500, "error"],
    ];
    for (const [status, kind] of codes) {
      const f = vi.fn<FetchLike>().mockResolvedValue(jsonResp(status, {}));
      expect(
        (await listAdminAudit("https://api.example", "t", 0, f)).kind,
      ).toBe(kind);
    }
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      (await listAdminAudit("https://api.example", "t", 0, netDown)).kind,
    ).toBe("error");
    const badBody = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    expect(
      (await listAdminAudit("https://api.example", "t", 0, badBody)).kind,
    ).toBe("error");
  });
});

describe("actOnVanityName", () => {
  it("POSTs to the action path with the bearer and maps 204 to ok", async () => {
    const f = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    expect(
      await actOnVanityName(
        {
          apiBase: "https://api.example",
          token: "t",
          name: "robin",
          action: "takedown",
        },
        f,
      ),
    ).toBe("ok");
    expect(f).toHaveBeenCalledWith(
      "https://api.example/admin/vanity/robin/takedown",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer t" },
      }),
    );
  });

  it("maps 401 to unauthorized, other statuses and network errors to error", async () => {
    const a = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    expect(
      await actOnVanityName(
        {
          apiBase: "https://api.example",
          token: "t",
          name: "x",
          action: "dismiss",
        },
        a,
      ),
    ).toBe("unauthorized");
    const b = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response(null, { status: 500 }));
    expect(
      await actOnVanityName(
        {
          apiBase: "https://api.example",
          token: "t",
          name: "x",
          action: "dismiss",
        },
        b,
      ),
    ).toBe("error");
    const c = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      await actOnVanityName(
        {
          apiBase: "https://api.example",
          token: "t",
          name: "x",
          action: "takedown",
        },
        c,
      ),
    ).toBe("error");
  });
});

describe("listAdminFeedback", () => {
  it("returns the queue on 200, sending the bearer in the header", async () => {
    const feedback = [
      { id: 2, reason: "broken", body: "share button dead", createdAt: 200 },
      { id: 1, reason: "confusing", body: "", createdAt: 100 },
    ];
    const ok = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResp(200, { feedback }));
    expect(await listAdminFeedback("https://api.example", "t", ok)).toEqual({
      kind: "ok",
      feedback,
    });
    expect(ok).toHaveBeenCalledWith(
      "https://api.example/admin/feedback",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer t" },
      }),
    );
  });

  it("defaults a missing feedback array to empty", async () => {
    const noField = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, {}));
    expect(
      await listAdminFeedback("https://api.example", "t", noField),
    ).toEqual({ kind: "ok", feedback: [] });
  });

  it("maps 401 to unauthorized, other statuses, network and bad body to error", async () => {
    const un = vi.fn<FetchLike>().mockResolvedValue(resp(401));
    expect((await listAdminFeedback("https://api.example", "t", un)).kind).toBe(
      "unauthorized",
    );
    const five = vi.fn<FetchLike>().mockResolvedValue(resp(503));
    expect(
      (await listAdminFeedback("https://api.example", "t", five)).kind,
    ).toBe("error");
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      (await listAdminFeedback("https://api.example", "t", netDown)).kind,
    ).toBe("error");
    const badBody = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    expect(
      (await listAdminFeedback("https://api.example", "t", badBody)).kind,
    ).toBe("error");
  });
});

describe("resolveFeedback", () => {
  it("POSTs to the resolve path with the bearer and maps 204 to ok", async () => {
    const f = vi.fn<FetchLike>().mockResolvedValue(resp(204));
    expect(await resolveFeedback("https://api.example", "t", 7, f)).toBe("ok");
    expect(f).toHaveBeenCalledWith(
      "https://api.example/admin/feedback/7/resolve",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer t" },
      }),
    );
  });

  it("maps 401 to unauthorized, other statuses and network errors to error", async () => {
    const un = vi.fn<FetchLike>().mockResolvedValue(resp(401));
    expect(await resolveFeedback("https://api.example", "t", 1, un)).toBe(
      "unauthorized",
    );
    const five = vi.fn<FetchLike>().mockResolvedValue(resp(500));
    expect(await resolveFeedback("https://api.example", "t", 1, five)).toBe(
      "error",
    );
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(await resolveFeedback("https://api.example", "t", 1, netDown)).toBe(
      "error",
    );
  });
});

describe("lookupRecord", () => {
  it("GETs the lookup path with the bearer and returns the metadata on 200", async () => {
    const record = {
      alias: { exists: true, sizeBytes: 2048, updatedAt: 5 },
      account: { exists: false, sizeBytes: 0, updatedAt: 0 },
      inbox: { exists: false, sizeBytes: 0, updatedAt: 0 },
    };
    const ok = vi.fn<FetchLike>().mockResolvedValue(jsonResp(200, record));
    expect(await lookupRecord("https://api.example", "t", "a1b2", ok)).toEqual({
      kind: "ok",
      record,
    });
    expect(ok).toHaveBeenCalledWith(
      "https://api.example/admin/lookup/a1b2",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer t" },
      }),
    );
    // The id rides the path only; the bearer stays in the header.
    expect(ok.mock.calls.every(([url]) => !url.includes("Bearer"))).toBe(true);
  });

  it("defaults a missing namespace to not-exists (never undefined in the UI)", async () => {
    const partial = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResp(200, { account: { exists: true } }));
    expect(
      await lookupRecord("https://api.example", "t", "x", partial),
    ).toEqual({
      kind: "ok",
      record: {
        alias: { exists: false, sizeBytes: 0, updatedAt: 0 },
        account: { exists: true, sizeBytes: 0, updatedAt: 0 },
        inbox: { exists: false, sizeBytes: 0, updatedAt: 0 },
      },
    });
  });

  it("maps 401 to unauthorized and other failures to error", async () => {
    const un = vi.fn<FetchLike>().mockResolvedValue(resp(401));
    expect((await lookupRecord("https://api.example", "t", "x", un)).kind).toBe(
      "unauthorized",
    );
    const five = vi.fn<FetchLike>().mockResolvedValue(resp(500));
    expect(
      (await lookupRecord("https://api.example", "t", "x", five)).kind,
    ).toBe("error");
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(
      (await lookupRecord("https://api.example", "t", "x", netDown)).kind,
    ).toBe("error");
    const badBody = vi
      .fn<FetchLike>()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    expect(
      (await lookupRecord("https://api.example", "t", "x", badBody)).kind,
    ).toBe("error");
  });
});

describe("disableAccount", () => {
  it("POSTs the disable path with the bearer and maps 204 to ok", async () => {
    const f = vi.fn<FetchLike>().mockResolvedValue(resp(204));
    expect(await disableAccount("https://api.example", "t", "acc1", f)).toBe(
      "ok",
    );
    expect(f).toHaveBeenCalledWith(
      "https://api.example/admin/account/acc1/disable",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer t" },
      }),
    );
  });

  it("maps 401 to unauthorized, other statuses and network errors to error", async () => {
    const un = vi.fn<FetchLike>().mockResolvedValue(resp(401));
    expect(await disableAccount("https://api.example", "t", "a", un)).toBe(
      "unauthorized",
    );
    const five = vi.fn<FetchLike>().mockResolvedValue(resp(500));
    expect(await disableAccount("https://api.example", "t", "a", five)).toBe(
      "error",
    );
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(await disableAccount("https://api.example", "t", "a", netDown)).toBe(
      "error",
    );
  });
});

describe("revokeAlias", () => {
  it("POSTs the revoke path with the bearer and maps 204 to ok", async () => {
    const f = vi.fn<FetchLike>().mockResolvedValue(resp(204));
    expect(await revokeAlias("https://api.example", "t", "lnk1", f)).toBe("ok");
    expect(f).toHaveBeenCalledWith(
      "https://api.example/admin/alias/lnk1/revoke",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer t" },
      }),
    );
  });

  it("maps 401 to unauthorized, other statuses and network errors to error", async () => {
    const un = vi.fn<FetchLike>().mockResolvedValue(resp(401));
    expect(await revokeAlias("https://api.example", "t", "l", un)).toBe(
      "unauthorized",
    );
    const five = vi.fn<FetchLike>().mockResolvedValue(resp(500));
    expect(await revokeAlias("https://api.example", "t", "l", five)).toBe(
      "error",
    );
    const netDown = vi.fn<FetchLike>().mockRejectedValue(new Error("offline"));
    expect(await revokeAlias("https://api.example", "t", "l", netDown)).toBe(
      "error",
    );
  });
});
