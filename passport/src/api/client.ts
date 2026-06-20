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

export interface ApiClient {
  getAlias(id: string): Promise<Bytes>;
  putAlias(id: string, payload: Bytes, writeToken: string): Promise<void>;
  getAccount(id: string): Promise<{ blob: Bytes; version: string } | null>;
  putAccount(
    id: string,
    blob: Bytes,
    ifVersion?: string,
  ): Promise<{ version: string }>;
  deleteAccount(id: string): Promise<void>;
  notify(tokenHash: string): Promise<void>;
  knock(id: string, requesterHash: string): Promise<void>;
  registerPush(req: PushRegisterRequest): Promise<void>;
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

  return {
    async getAlias(id) {
      if (!validId(id)) throw new ApiError("badRequest", "malformed alias id");
      const res = await call(PATHS.aliasPrefix + id, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "alias get");
      const body = await readBytes(res);
      if (body.length !== ALIAS_PAYLOAD_SIZE) {
        throw new ApiError(
          "protocol",
          `alias payload was ${body.length} bytes`,
        );
      }
      return body;
    },

    async putAlias(id, payload, writeToken) {
      if (!validId(id)) throw new ApiError("badRequest", "malformed alias id");
      if (payload.length !== ALIAS_PAYLOAD_SIZE) {
        throw new ApiError("protocol", "alias payload must be the fixed size");
      }
      const res = await call(PATHS.aliasPrefix + id, {
        method: "PUT",
        headers: {
          "Content-Type": OCTET_STREAM,
          [HEADER_WRITE_TOKEN]: writeToken,
        },
        body: payload,
      });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "alias put");
    },

    async getAccount(id) {
      assertAccountId(id);
      const res = await call(PATHS.accountPrefix + id, {
        method: "GET",
        cache: "no-store",
      });
      if (res.status === 404) return null; // no sync blob yet (the empty case)
      if (!res.ok) throw new ApiError(statusToKind(res.status), "account get");
      const version = res.headers.get(HEADER_VERSION);
      if (version === null) {
        throw new ApiError("protocol", "account get missing version header");
      }
      return { blob: await readBytes(res), version };
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
      const version = res.headers.get(HEADER_VERSION);
      if (version === null) {
        throw new ApiError("protocol", "account put missing version header");
      }
      return { version };
    },

    async deleteAccount(id) {
      assertAccountId(id);
      const res = await call(PATHS.accountPrefix + id, { method: "DELETE" });
      if (!res.ok)
        throw new ApiError(statusToKind(res.status), "account delete");
    },

    async notify(tokenHash) {
      const res = await call(PATHS.notify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash }),
      });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "notify");
    },

    async knock(id, requesterHash) {
      const res = await call(PATHS.knockPrefix + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterHash }),
      });
      // The body is uniform; a transport failure still surfaces as unreachable.
      if (!res.ok) throw new ApiError(statusToKind(res.status), "knock");
    },

    async registerPush(req) {
      const res = await call(PATHS.pushRegister, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok)
        throw new ApiError(statusToKind(res.status), "push register");
    },

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
