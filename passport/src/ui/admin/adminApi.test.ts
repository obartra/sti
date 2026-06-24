import { describe, it, expect, vi } from "vitest";
import { pingAdmin, type FetchLike } from "./adminApi.ts";

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
