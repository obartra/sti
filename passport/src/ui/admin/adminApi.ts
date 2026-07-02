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

// --- Service metrics (A5, doc 20) -------------------------------------------

const ADMIN_METRICS_PATH = "/admin/metrics";

/** Aggregate, identifier-free service totals (mirrors the server's
 * AdminMetricsResponse). Every field is a count of opaque rows or a system size,
 * never a per-account or per-id figure (doc 12 / doc 20 A5). */
export interface AdminMetrics {
  accounts: number;
  aliases: number;
  knocks: number;
  sendQueueDepth: number;
  dbSizeBytes: number;
  pendingReports: number;
  pendingFeedback: number;
}

export type AdminMetricsResult =
  | { kind: "ok"; metrics: AdminMetrics }
  | { kind: "unauthorized" }
  | { kind: "error" };

const ZERO_METRICS: AdminMetrics = {
  accounts: 0,
  aliases: 0,
  knocks: 0,
  sendQueueDepth: 0,
  dbSizeBytes: 0,
  pendingReports: 0,
  pendingFeedback: 0,
};

/**
 * Fetch the aggregate service totals for the metrics panel. Same error shape as the
 * other reads: 401 surfaces distinctly so the page can re-lock; any other non-200, a
 * network failure, or a malformed body is a generic error the panel shows with a
 * retry. A missing field defaults to 0 so a partial body never renders NaN.
 */
export async function getAdminMetrics(
  apiBase: string,
  token: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminMetricsResult> {
  let res: Response;
  try {
    res = await fetchImpl(apiBase + ADMIN_METRICS_PATH, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status !== 200) return { kind: "error" };
  try {
    const body = (await res.json()) as Partial<AdminMetrics>;
    return { kind: "ok", metrics: { ...ZERO_METRICS, ...body } };
  } catch {
    return { kind: "error" };
  }
}

// --- Aggregate trends (doc 20 metrics panel) --------------------------------

const ADMIN_TRENDS_PATH = "/admin/trends";

/** Default trends window (days); mirrors the server's clamp default. */
const TRENDS_DAYS = 30;

/** One daily bucket of the reports-per-day series (mirrors the server's DayCount).
 * `day` is an epoch-day (days since the Unix epoch, UTC); `count` is opaque rows. */
interface DayCount {
  day: number;
  count: number;
}

/** One bar of the review-latency histogram (mirrors the server's LatencyBucket): how
 * many still-open reports have waited less than `underMs`. `underMs` 0 is the
 * trailing "older" overflow bucket. */
interface LatencyBucket {
  underMs: number;
  count: number;
}

/** Aggregate per-day trends + review latency (mirrors the server's
 * AdminTrendsResponse). Every field is a count of opaque rows in a day or a latency
 * bucket, never a per-account or per-id figure (doc 12 / doc 20). */
export interface AdminTrends {
  reportsPerDay: DayCount[];
  reviewLatency: LatencyBucket[];
}

export type AdminTrendsResult =
  | { kind: "ok"; trends: AdminTrends }
  | { kind: "unauthorized" }
  | { kind: "error" };

/**
 * Fetch the aggregate trend series for the metrics panel. `days` is the recent window
 * (the server clamps it). Same error shape as the other reads: 401 surfaces distinctly
 * so the page can re-lock; any other non-200, a network failure, or a malformed body is
 * a generic error. Missing series default to empty so a partial body never renders NaN.
 */
export async function getAdminTrends(
  apiBase: string,
  token: string,
  days = TRENDS_DAYS,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminTrendsResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${apiBase}${ADMIN_TRENDS_PATH}?days=${days}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status !== 200) return { kind: "error" };
  try {
    const body = (await res.json()) as Partial<AdminTrends>;
    return {
      kind: "ok",
      trends: {
        reportsPerDay: body.reportsPerDay ?? [],
        reviewLatency: body.reviewLatency ?? [],
      },
    };
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

// --- "Something wrong?" review (doc 35) -------------------------------------

const ADMIN_FEEDBACK_PATH = "/admin/feedback";

/** One "Something wrong?" report in the queue (mirrors the server's AdminFeedback).
 * `body` is the note the person typed, `id` is the resolve target. */
export interface AdminFeedback {
  id: number;
  reason: string;
  body: string;
  createdAt: number;
}

export type AdminFeedbackResult =
  | { kind: "ok"; feedback: AdminFeedback[] }
  | { kind: "unauthorized" }
  | { kind: "error" };

/**
 * Fetch the open "Something wrong?" report queue. Same error shape as the other
 * reads: 401 surfaces distinctly so the page can re-lock; any other non-200, a
 * network failure, or a malformed body is a generic error the panel shows.
 */
export async function listAdminFeedback(
  apiBase: string,
  token: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminFeedbackResult> {
  let res: Response;
  try {
    res = await fetchImpl(apiBase + ADMIN_FEEDBACK_PATH, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status !== 200) return { kind: "error" };
  try {
    const body = (await res.json()) as { feedback?: AdminFeedback[] };
    return { kind: "ok", feedback: body.feedback ?? [] };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Resolve a report (the operator has handled it), which deletes it from the queue.
 * 204 = done; 401 re-locks; anything else is a generic error.
 */
export async function resolveFeedback(
  apiBase: string,
  token: string,
  id: number,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminActionResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${apiBase}/admin/feedback/${id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return "error";
  }
  if (res.status === 204) return "ok";
  if (res.status === 401) return "unauthorized";
  return "error";
}

// --- Account / alias management (A3, doc 20) --------------------------------

/** Opaque metadata for one stored record (mirrors the server's AdminRecordInfo):
 * whether it exists, its ciphertext byte size, and when it was last written. Never
 * any content, ever, so it stays within the blind-store boundary. */
export interface AdminRecordInfo {
  exists: boolean;
  sizeBytes: number;
  updatedAt: number;
}

/** A record lookup's result (mirrors the server's AdminLookupResponse): opaque
 * metadata for the id across the namespaces it could belong to. At most one is
 * present; a missing record reads back as all three not-exists. */
export interface AdminLookup {
  alias: AdminRecordInfo;
  account: AdminRecordInfo;
  inbox: AdminRecordInfo;
}

export type AdminLookupResult =
  | { kind: "ok"; record: AdminLookup }
  | { kind: "unauthorized" }
  | { kind: "error" };

const EMPTY_INFO: AdminRecordInfo = {
  exists: false,
  sizeBytes: 0,
  updatedAt: 0,
};

/**
 * Look up opaque metadata for an id (exists / byte size / last-written) across the
 * alias, account, and inbox namespaces. Same error shape as the other reads: 401
 * surfaces distinctly so the page can re-lock; any other non-200, a network failure,
 * or a malformed body is a generic error. A missing namespace defaults to
 * not-exists so a partial body never renders undefined. Returns metadata only,
 * never content (there is none: the store holds only ciphertext).
 */
export async function lookupRecord(
  apiBase: string,
  token: string,
  id: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminLookupResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${apiBase}/admin/lookup/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status !== 200) return { kind: "error" };
  try {
    const body = (await res.json()) as Partial<AdminLookup>;
    return {
      kind: "ok",
      record: {
        alias: { ...EMPTY_INFO, ...body.alias },
        account: { ...EMPTY_INFO, ...body.account },
        inbox: { ...EMPTY_INFO, ...body.inbox },
      },
    };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Disable an account: a working-delete of its sync blob. 204 = done; 401 re-locks;
 * anything else is a generic error. Idempotent on the server, so a re-run is safe.
 */
export async function disableAccount(
  apiBase: string,
  token: string,
  id: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminActionResult> {
  let res: Response;
  try {
    res = await fetchImpl(
      `${apiBase}/admin/account/${encodeURIComponent(id)}/disable`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    return "error";
  }
  if (res.status === 204) return "ok";
  if (res.status === 401) return "unauthorized";
  return "error";
}

/**
 * Revoke a link: force-remove the alias row (it then reads back as a decoy) and
 * release any vanity name it holds into the 24h lock. 204 = done; 401 re-locks;
 * anything else is a generic error. Idempotent on the server, so a re-run is safe.
 */
export async function revokeAlias(
  apiBase: string,
  token: string,
  id: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminActionResult> {
  let res: Response;
  try {
    res = await fetchImpl(
      `${apiBase}/admin/alias/${encodeURIComponent(id)}/revoke`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    return "error";
  }
  if (res.status === 204) return "ok";
  if (res.status === 401) return "unauthorized";
  return "error";
}
