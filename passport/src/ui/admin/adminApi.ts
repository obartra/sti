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

// --- Findable review (A2) ---------------------------------------------------

const ADMIN_REPORTS_PATH = "/admin/reports";

/** One reported name in the review queue (mirrors the server's AdminReport). */
export interface AdminReport {
  name: string;
  reason: string;
  count: number;
  createdAt: number;
}

export type AdminReportsResult =
  | { kind: "ok"; reports: AdminReport[] }
  | { kind: "unauthorized" }
  | { kind: "error" };

/**
 * Fetch the pending vanity-name report queue. 401 surfaces distinctly so the page
 * can re-lock; any other non-200, a network failure, or a malformed body is a
 * generic error the panel shows with a retry.
 */
export async function listAdminReports(
  apiBase: string,
  token: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminReportsResult> {
  let res: Response;
  try {
    res = await fetchImpl(apiBase + ADMIN_REPORTS_PATH, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status !== 200) return { kind: "error" };
  try {
    const body = (await res.json()) as { reports?: AdminReport[] };
    return { kind: "ok", reports: body.reports ?? [] };
  } catch {
    return { kind: "error" };
  }
}

// --- Recent activity (A4, doc 20) -------------------------------------------

const ADMIN_AUDIT_PATH = "/admin/audit";

/** Activity page size: how many actions a single fetch pulls. A full page back
 * means there may be older ones, which is how the panel decides to offer "load
 * older". Kept in step with the server's default `limit`. */
export const AUDIT_PAGE = 50;

/** One recorded admin action (mirrors the server's AdminAuditEntry). `id` is the
 * monotonic cursor passed back as `before` to page to older entries. */
export interface AdminAuditEntry {
  id: number;
  action: string;
  target: string;
  createdAt: number;
}

export type AdminAuditResult =
  | { kind: "ok"; entries: AdminAuditEntry[] }
  | { kind: "unauthorized" }
  | { kind: "error" };

/**
 * Fetch a page of admin actions (newest first). `before` is a row-id cursor (the
 * id of the oldest entry already shown, 0/omitted for the first page). Same error
 * shape as the report list: 401 surfaces distinctly so the page can re-lock; any
 * other non-200, a network failure, or a malformed body is a generic error.
 */
export async function listAdminAudit(
  apiBase: string,
  token: string,
  before = 0,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminAuditResult> {
  const cursor = before > 0 ? `&before=${before}` : "";
  let res: Response;
  try {
    res = await fetchImpl(
      `${apiBase}${ADMIN_AUDIT_PATH}?limit=${AUDIT_PAGE}${cursor}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status !== 200) return { kind: "error" };
  try {
    const body = (await res.json()) as { entries?: AdminAuditEntry[] };
    return { kind: "ok", entries: body.entries ?? [] };
  } catch {
    return { kind: "error" };
  }
}

export type AdminAction = "takedown" | "dismiss";
export type AdminActionResult = "ok" | "unauthorized" | "error";

/** What a reviewer action needs: the surface, the bearer, the name, the verb. */
export interface VanityAction {
  apiBase: string;
  token: string;
  name: string;
  action: AdminAction;
}

/**
 * Act on a reported name: `takedown` (revoke into the 24h lock + clear reports) or
 * `dismiss` (clear reports, no action). 204 = done; 401 re-locks; anything else is
 * a generic error. The name is path-encoded defensively (it is already [a-z0-9_]).
 */
export async function actOnVanityName(
  { apiBase, token, name, action }: VanityAction,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminActionResult> {
  let res: Response;
  try {
    res = await fetchImpl(
      `${apiBase}/admin/vanity/${encodeURIComponent(name)}/${action}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    return "error";
  }
  if (res.status === 204) return "ok";
  if (res.status === 401) return "unauthorized";
  return "error";
}
