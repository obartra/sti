/**
 * Transport for the console's server-ops surface (doc 20): the recent-log read
 * and the audited restart. Split from adminApi.ts so each file stays within its
 * length ceiling; same conventions (token only in the Authorization header, 401
 * distinct from transport errors so the page can re-lock).
 */

import {
  adminGetJson,
  type AdminActionResult,
  type FetchLike,
} from "./adminApi.ts";

// --- Server ops: recent logs + restart (doc 20) ------------------------------

const ADMIN_LOGS_PATH = "/admin/logs";

/** One recent service log line (mirrors the server's AdminLogEntry): the instant,
 * the level, the fixed message, and the rendered attrs. Log lines carry counts and
 * errors only, never an id, token, IP, or user-typed text (doc 12). */
export interface AdminLogEntry {
  at: number;
  level: string;
  msg: string;
  attrs?: string;
}

export type AdminLogsResult =
  | { kind: "ok"; entries: AdminLogEntry[] }
  | { kind: "unauthorized" }
  | { kind: "error" };

// Default log page: enough to read back through recent activity in one fetch
// without pulling the whole in-process buffer.
const LOGS_PAGE = 200;

/**
 * Fetch the service's most recent log lines, newest first. Same error shape as
 * the other reads: 401 surfaces distinctly so the page can re-lock; any other
 * non-200, a network failure, or a malformed body is a generic error.
 */
export async function listAdminLogs(
  apiBase: string,
  token: string,
  opts: { limit?: number; level?: string; fetchImpl?: FetchLike } = {},
): Promise<AdminLogsResult> {
  const {
    limit = LOGS_PAGE,
    level = "",
    fetchImpl = (input, init) => globalThis.fetch(input, init),
  } = opts;
  const filter = level === "" ? "" : `&level=${level}`;
  const r = await adminGetJson<{ entries?: AdminLogEntry[] }>(
    `${apiBase}${ADMIN_LOGS_PATH}?limit=${limit}${filter}`,
    token,
    fetchImpl,
  );
  if (r.kind !== "ok") return r;
  return { kind: "ok", entries: r.body.entries ?? [] };
}

/**
 * Ask the service to restart itself: it records the request, drains what it is
 * doing, exits, and systemd brings it back a couple of seconds later. 202 = the
 * restart is underway; 401 re-locks; anything else is a generic error.
 */
export async function restartServer(
  apiBase: string,
  token: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminActionResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${apiBase}/admin/restart`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return "error";
  }
  if (res.status === 202) return "ok";
  if (res.status === 401) return "unauthorized";
  return "error";
}

// --- Error tracking + performance (doc 20) -----------------------------------

/** One UTC epoch-day of internal-error counts by fixed subsystem (mirrors the
 * server's AdminErrorDay). Counts of events, never a message or value. */
interface AdminErrorDay {
  day: number;
  store: number;
  enqueue: number;
  janitor: number;
  decode: number;
}

export interface AdminErrors {
  days: AdminErrorDay[];
  totals: { type: string; count: number }[];
}

export type AdminErrorsResult =
  | { kind: "ok"; errors: AdminErrors }
  | { kind: "unauthorized" }
  | { kind: "error" };

// The errors window (days): a month is enough to see a pattern without the
// chart turning into a picket fence.
const ERRORS_DAYS = 30;

/**
 * Fetch the per-day error series + lifetime totals. Same error shape as the
 * other reads; missing fields default to empty so a partial body never NaNs.
 */
export async function getAdminErrors(
  apiBase: string,
  token: string,
  days = ERRORS_DAYS,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminErrorsResult> {
  const r = await adminGetJson<Partial<AdminErrors>>(
    `${apiBase}/admin/errors?days=${days}`,
    token,
    fetchImpl,
  );
  if (r.kind !== "ok") return r;
  return {
    kind: "ok",
    errors: { days: r.body.days ?? [], totals: r.body.totals ?? [] },
  };
}

/** One latency histogram bar: how many requests finished under `underMs`
 * (0 = the trailing slower-than-the-last-bound overflow). */
interface AdminLatencyBucket {
  underMs: number;
  count: number;
}

export interface AdminPerf {
  requestsPerDay: { day: number; count: number }[];
  latency: AdminLatencyBucket[];
}

export type AdminPerfResult =
  | { kind: "ok"; perf: AdminPerf }
  | { kind: "unauthorized" }
  | { kind: "error" };

/**
 * Fetch requests-per-day + the aggregate latency histogram. Same conventions
 * as every other admin read.
 */
export async function getAdminPerf(
  apiBase: string,
  token: string,
  days = ERRORS_DAYS,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminPerfResult> {
  const r = await adminGetJson<Partial<AdminPerf>>(
    `${apiBase}/admin/perf?days=${days}`,
    token,
    fetchImpl,
  );
  if (r.kind !== "ok") return r;
  return {
    kind: "ok",
    perf: {
      requestsPerDay: r.body.requestsPerDay ?? [],
      latency: r.body.latency ?? [],
    },
  };
}

/**
 * Zero the lifetime error totals (an audited admin action; the per-day history
 * stays). 204 = done; 401 re-locks; anything else is a generic error.
 */
export async function clearAdminErrors(
  apiBase: string,
  token: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminActionResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${apiBase}/admin/errors/clear`, {
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

// --- Service health (doc 20) ------------------------------------------------

const ADMIN_HEALTH_PATH = "/admin/health";

/** One subsystem's internal-error count in the health snapshot (mirrors the server's
 * AdminErrorCount): a fixed subsystem name and a running total, never a message. */
interface AdminErrorCount {
  type: string;
  count: number;
}

/** Aggregate, identifier-free operational-health signals (mirrors the server's
 * AdminHealthResponse). Surfaces a backing-up send queue, a stalled background loop,
 * or a rise in internal errors so they are visible on the page instead of only by
 * reading /metrics on the box. Every field is a count, an age, or a system size,
 * never a per-account or per-id figure (doc 12 / doc 20). `janitorAgeSeconds` is -1
 * when the background loop has never run. */
export interface AdminHealth {
  errors: AdminErrorCount[];
  /** Today's UTC bucket only: the is-it-on-fire-now read, distinct from the
   * lifetime totals above, which survive restarts. */
  errorsToday: AdminErrorCount[];
  sendQueueDepth: number;
  sendQueueOldestAgeSeconds: number;
  janitorAgeSeconds: number;
  inflightCurrent: number;
  inflightMax: number;
  /** The box strip: which binary is running, for how long, and how much disk
   * is left under the database. System facts, never subject data. */
  buildVersion?: string;
  uptimeSeconds: number;
  diskFreeBytes: number;
}

export type AdminHealthResult =
  | { kind: "ok"; health: AdminHealth }
  | { kind: "unauthorized" }
  | { kind: "error" };

const ZERO_HEALTH: Omit<AdminHealth, "errors" | "errorsToday"> = {
  sendQueueDepth: 0,
  sendQueueOldestAgeSeconds: 0,
  janitorAgeSeconds: -1,
  inflightCurrent: 0,
  inflightMax: 0,
  uptimeSeconds: 0,
  diskFreeBytes: 0,
};

/**
 * Fetch the aggregate health snapshot for the console's health panel. Same error
 * shape as the other reads: 401 surfaces distinctly so the page can re-lock; any
 * other non-200, a network failure, or a malformed body is a generic error the panel
 * shows with a retry. Missing fields default (errors to empty, ages/counts to 0, the
 * heartbeat age to the -1 "never ran" flag) so a partial body never renders NaN.
 */
export async function getAdminHealth(
  apiBase: string,
  token: string,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminHealthResult> {
  const r = await adminGetJson<Partial<AdminHealth>>(
    apiBase + ADMIN_HEALTH_PATH,
    token,
    fetchImpl,
  );
  if (r.kind !== "ok") return r;
  return {
    kind: "ok",
    health: {
      ...ZERO_HEALTH,
      ...r.body,
      errors: r.body.errors ?? [],
      errorsToday: r.body.errorsToday ?? [],
    },
  };
}
