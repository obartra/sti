/**
 * The wire contract, mirrored from the Go source of truth
 * (server/internal/contract/contract.go). These constants and shapes must stay
 * in lockstep with the server; the integration test asserts the load-bearing
 * ones (id length, fixed alias size, knock status) against the running server,
 * so drift fails a test rather than shipping silently.
 */

/** base64url of 32 random bytes, a fixed 43 chars. */
export const ID_ENCODED_LEN = 43;
export const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Every GET /a response is exactly this many bytes (real padded, or decoy). */
export const ALIAS_PAYLOAD_SIZE = 4096;
/** Upper bound on the account-sync blob. */
export const ACCOUNT_BLOB_MAX_SIZE = 1 << 20;

export const PATHS = {
  aliasPrefix: "/a/",
  inboxPrefix: "/inbox/",
  accountPrefix: "/acct/",
  notify: "/notify",
  pushRegister: "/push/register",
  knockPrefix: "/knock/",
  health: "/healthz",
} as const;

export const HEADER_WRITE_TOKEN = "X-Write-Token";
export const HEADER_VERSION = "X-Version";

/** The single value POST /knock ever returns. */
export const KNOCK_STATUS = "received";

export function validId(s: string): boolean {
  return ID_PATTERN.test(s);
}

export interface NotifyRequest {
  readonly tokenHash: string;
}

export interface KnockRequest {
  readonly requesterHash: string;
}

export interface KnockResponse {
  readonly status: string;
}

export interface PushSubscription {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

export interface PushRegisterRequest {
  readonly routingEndpointId: string;
  readonly subscription: PushSubscription;
}
