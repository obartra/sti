import { describe, it, expect, vi } from "vitest";
import {
  actOnVanityName,
  getAdminMetrics,
  listAdminAudit,
  listAdminFeedback,
  listAdminReports,
  pingAdmin,
  resolveFeedback,
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
