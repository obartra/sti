import { describe, it, expect, vi } from "vitest";
import {
  actOnVanityName,
  listAdminReports,
  pingAdmin,
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
