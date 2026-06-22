/**
 * Typed transport over the blind-store contract. One method per endpoint; it
 * carries opaque bytes and ids only, never plaintext (the crypto layer above it
 * seals/opens). Every failure becomes a typed {@link ApiError} so the store can
 * map "unreachable or shed" to gray without inspecting HTTP status codes.
 *
 * Existence-uniformity is preserved by construction: getAlias always returns the
 * fixed-size body the server sends (real or decoy), and never signals a miss; a
 * miss is discovered only when the crypto layer fails to open it.
 */

import type { Bytes } from "../crypto/encoding.ts";
import {
  ALIAS_PAYLOAD_SIZE,
  HEADER_VERSION,
  HEADER_WRITE_TOKEN,
  PATHS,
  validId,
  type PushRegisterRequest,
} from "./contract.ts";

export type ApiErrorKind =
  | "unreachable" // network failure or a shed (503): map to gray
  | "rateLimited" // 429
  | "server" // 5xx other than 503
  | "forbidden" // 403, e.g. a write-token mismatch
  | "badRequest" // 400, including a malformed id
  | "tooLarge" // 413, account blob over the cap
  | "protocol"; // a response that violates the contract

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * One waiting knock as the owner sees it on review: the opaque per-requester
 * token, plus an optional ephemeral public key the owner can seal an in-app grant
 * to (doc 13). Both are opaque; neither names anyone.
 */
export interface PendingKnock {
  readonly requesterHash: string;
  readonly pubKey?: string;
}

/** The owner's review of an alias: the live knock count and the pending list. */
export interface KnockReview {
  readonly count: number;
  readonly pending: PendingKnock[];
}

export interface ApiClient {
  getAlias(id: string): Promise<Bytes>;
  putAlias(id: string, payload: Bytes, writeToken: string): Promise<void>;
  /** Read a notify inbox (doc 13): the same fixed-size, existence-uniform read as
   * an alias, on the /inbox path. A miss is a decoy, indistinguishable from empty. */
  getInbox(id: string): Promise<Bytes>;
  /** Write a notify inbox, gated by its write token (the recipient's capability). */
  putInbox(id: string, payload: Bytes, writeToken: string): Promise<void>;
  getAccount(id: string): Promise<{ blob: Bytes; version: string } | null>;
  putAccount(
    id: string,
    blob: Bytes,
    ifVersion?: string,
  ): Promise<{ version: string }>;
  deleteAccount(id: string): Promise<void>;
  notify(tokenHash: string): Promise<void>;
  /**
   * Knock on an alias. pubKey is an optional per-requester ephemeral public key
   * the requester keeps the private half of, so the owner can seal a grant to it.
   */
  knock(id: string, requesterHash: string, pubKey?: string): Promise<void>;
  /** Owner-only: the count of current knocks on an alias, authed by its token. */
  knockCount(id: string, writeToken: string): Promise<number>;
  /** Owner-only: the full review (count + pending requesters), authed by its token. */
  knockReview(id: string, writeToken: string): Promise<KnockReview>;
  registerPush(req: PushRegisterRequest): Promise<void>;
  /**
   * The server's active Web Push public key, or null when push is unconfigured /
   * unreachable. Public and cacheable; a browser needs it to subscribe.
   */
  getVapidPublicKey(): Promise<string | null>;
  health(): Promise<boolean>;
}

const OCTET_STREAM = "application/octet-stream";

/** Reject a malformed account id before it hits the wire (shared by acct ops). */
function assertAccountId(id: string): void {
  if (!validId(id)) throw new ApiError("badRequest", "malformed account id");
}

/** Read a response body as raw bytes (captures nothing; hoisted out of the client). */
async function readBytes(res: Response): Promise<Bytes> {
  return new Uint8Array(await res.arrayBuffer());
}

/** The fixed-size alias body, or a protocol error (existence-uniformity invariant). */
function requireAliasSize(body: Bytes): Bytes {
  if (body.length !== ALIAS_PAYLOAD_SIZE) {
    throw new ApiError("protocol", `alias payload was ${body.length} bytes`);
  }
  return body;
}

/**
 * Parse a knock-review JSON body defensively. An unexpected shape (or a missing
 * pending list, e.g. an older server that only returns a count) degrades to a
 * sensible value rather than throwing: the count falls back to 0 and pending to
 * an empty list, and only well-formed `{requesterHash, pubKey?}` entries survive.
 */
function parseKnockReview(json: unknown): KnockReview {
  const body = (json ?? {}) as { count?: unknown; pending?: unknown };
  const count = typeof body.count === "number" ? body.count : 0;
  const pending: PendingKnock[] = Array.isArray(body.pending)
    ? body.pending.flatMap((entry): PendingKnock[] => {
        const e = entry as { requesterHash?: unknown; pubKey?: unknown };
        if (typeof e.requesterHash !== "string") return [];
        return [
          typeof e.pubKey === "string"
            ? { requesterHash: e.requesterHash, pubKey: e.pubKey }
            : { requesterHash: e.requesterHash },
        ];
      })
    : [];
  return { count, pending };
}

/** POST a JSON body and throw a mapped ApiError on a non-ok status (hoisted so the
 * several POST-json endpoints share one shape). Returns the response for callers
 * that read it. */
async function postJson(
  call: (path: string, init?: RequestInit) => Promise<Response>,
  path: string,
  body: unknown,
  label: string,
): Promise<Response> {
  const res = await call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(statusToKind(res.status), label);
  return res;
}

/** The X-Version header the account endpoints must return, or a protocol error. */
function requireVersion(res: Response, op: string): string {
  const version = res.headers.get(HEADER_VERSION);
  if (version === null) {
    throw new ApiError("protocol", `${op} missing version header`);
  }
  return version;
}

/** The server's active Web Push public key, or null when unconfigured/unreachable. */
async function fetchVapidPublicKey(
  call: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<string | null> {
  try {
    const res = await call(PATHS.vapid, { method: "GET" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const key =
      typeof body === "object" && body !== null
        ? (body as { publicKey?: unknown }).publicKey
        : undefined;
    return typeof key === "string" && key !== "" ? key : null;
  } catch {
    return null;
  }
}

/** The owner's review of a knock id: live count plus the well-formed pending list. */
async function fetchKnockReview(
  call: (path: string, init?: RequestInit) => Promise<Response>,
  id: string,
  writeToken: string,
): Promise<KnockReview> {
  const res = await call(PATHS.knockPrefix + id, {
    method: "GET",
    cache: "no-store",
    headers: { [HEADER_WRITE_TOKEN]: writeToken },
  });
  if (!res.ok) throw new ApiError(statusToKind(res.status), "knock review");
  return parseKnockReview(await res.json());
}

/** Map a non-ok HTTP status to the typed error kind. */
function statusToKind(status: number): ApiErrorKind {
  if (status === 429) return "rateLimited";
  if (status === 403) return "forbidden";
  if (status === 413) return "tooLarge";
  if (status === 400) return "badRequest";
  if (status === 503) return "unreachable"; // load-shed degrades to gray
  if (status >= 500) return "server";
  return "protocol";
}

export function createApiClient(
  baseUrl: string,
  fetchImpl?: FetchLike,
): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike =
    fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

  async function call(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await doFetch(root + path, init);
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      // A thrown fetch is a network failure: unreachable, which becomes gray.
      throw new ApiError("unreachable", `request to ${path} failed`, { cause });
    }
  }

  // The alias card and notify inbox are byte-for-byte the same blind,
  // existence-uniform, write-token-gated fixed-size protocol, so they share one
  // GET and one PUT keyed by a {prefix, label} target.
  const ALIAS = { prefix: PATHS.aliasPrefix, label: "alias" };
  const INBOX = { prefix: PATHS.inboxPrefix, label: "inbox" };

  async function getFixed(t: { prefix: string; label: string }, id: string) {
    if (!validId(id))
      throw new ApiError("badRequest", `malformed ${t.label} id`);
    const res = await call(t.prefix + id, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new ApiError(statusToKind(res.status), `${t.label} get`);
    return requireAliasSize(await readBytes(res));
  }

  async function putFixed(
    t: { prefix: string; label: string },
    id: string,
    payload: Bytes,
    writeToken: string,
  ) {
    if (!validId(id))
      throw new ApiError("badRequest", `malformed ${t.label} id`);
    if (payload.length !== ALIAS_PAYLOAD_SIZE) {
      throw new ApiError(
        "protocol",
        `${t.label} payload must be the fixed size`,
      );
    }
    const res = await call(t.prefix + id, {
      method: "PUT",
      headers: {
        "Content-Type": OCTET_STREAM,
        [HEADER_WRITE_TOKEN]: writeToken,
      },
      body: payload,
    });
    if (!res.ok) throw new ApiError(statusToKind(res.status), `${t.label} put`);
  }

  return {
    getAlias(id) {
      return getFixed(ALIAS, id);
    },

    putAlias(id, payload, writeToken) {
      return putFixed(ALIAS, id, payload, writeToken);
    },

    getInbox(id) {
      return getFixed(INBOX, id);
    },

    putInbox(id, payload, writeToken) {
      return putFixed(INBOX, id, payload, writeToken);
    },

    async getAccount(id) {
      assertAccountId(id);
      const res = await call(PATHS.accountPrefix + id, {
        method: "GET",
        cache: "no-store",
      });
      if (res.status === 404) return null; // no sync blob yet (the empty case)
      if (!res.ok) throw new ApiError(statusToKind(res.status), "account get");
      return {
        blob: await readBytes(res),
        version: requireVersion(res, "account get"),
      };
    },

    async putAccount(id, blob, ifVersion) {
      assertAccountId(id);
      const headers: Record<string, string> = { "Content-Type": OCTET_STREAM };
      // Advisory today (the server is last-write-wins); sent for forward-compat
      // with optimistic concurrency.
      if (ifVersion !== undefined) headers[HEADER_VERSION] = ifVersion;
      const res = await call(PATHS.accountPrefix + id, {
        method: "PUT",
        headers,
        body: blob,
      });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "account put");
      return { version: requireVersion(res, "account put") };
    },

    async deleteAccount(id) {
      assertAccountId(id);
      const res = await call(PATHS.accountPrefix + id, { method: "DELETE" });
      if (!res.ok)
        throw new ApiError(statusToKind(res.status), "account delete");
    },

    async notify(tokenHash) {
      await postJson(call, PATHS.notify, { tokenHash }, "notify");
    },

    async knock(id, requesterHash, pubKey) {
      // Omit pubKey entirely when absent, so a contentless knock is byte-for-byte
      // the legacy shape and carries no empty field. The body is uniform; a
      // transport failure still surfaces as unreachable.
      const body = pubKey ? { requesterHash, pubKey } : { requesterHash };
      await postJson(call, PATHS.knockPrefix + id, body, "knock");
    },

    knockReview(id, writeToken) {
      return fetchKnockReview(call, id, writeToken);
    },

    async knockCount(id, writeToken) {
      return (await fetchKnockReview(call, id, writeToken)).count;
    },

    async registerPush(req) {
      await postJson(call, PATHS.pushRegister, req, "push register");
    },

    getVapidPublicKey: () => fetchVapidPublicKey(call),

    async health() {
      // A liveness probe is a boolean: unreachable/shed = not healthy, not error.
      try {
        const res = await call(PATHS.health, { method: "GET" });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
