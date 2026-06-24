/**
 * Transport for the operator surface's token gate (doc 20). Deliberately separate
 * from the blind-store api client: admin is an isolated, flag-gated surface, so it
 * does not ride the consumer contract. One call for A1: validate the bearer.
 *
 * The token is sent ONLY in the Authorization header, never in the URL, never
 * logged. A 401 is reported distinctly from a transport error so the page can say
 * "wrong token" vs "couldn't reach the service" without conflating the two.
 */

export type AdminPingResult = "ok" | "unauthorized" | "error";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

// The admin endpoints share this prefix on the api origin (mirrors the Go
// contract's PathAdminPing). Kept local so the consumer contract stays unaware of
// the admin surface.
const ADMIN_PING_PATH = "/admin/ping";

/**
 * Validate an admin bearer against GET /admin/ping. 204 = valid; 401 = missing or
 * wrong token; any other status, or a network failure, is a generic error the
 * page surfaces without claiming the token itself was rejected.
 */
export async function pingAdmin(
  apiBase: string,
  token: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminPingResult> {
  let res: Response;
  try {
    res = await fetchImpl(apiBase + ADMIN_PING_PATH, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return "error";
  }
  if (res.status === 204) return "ok";
  if (res.status === 401) return "unauthorized";
  return "error";
}
