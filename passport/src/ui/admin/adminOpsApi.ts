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
  limit = LOGS_PAGE,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<AdminLogsResult> {
  const r = await adminGetJson<{ entries?: AdminLogEntry[] }>(
    `${apiBase}${ADMIN_LOGS_PATH}?limit=${limit}`,
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
