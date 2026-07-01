/**
 * The recovery-envelope transport methods (doc 32), split out of client.ts to keep
 * that file within its size budget (like the account and vanity groups, which are
 * hoisted there). Same blind contract: the read is existence-uniform and fixed-size
 * (a decoy on a miss, discovered only when the crypto layer fails to open it), and
 * put/delete carry the account write token that gates the write. The locator is
 * URL-encoded like a vanity name.
 */

import {
  ApiError,
  OCTET_STREAM,
  readBytes,
  statusToKind,
  type ApiClient,
} from "./client.ts";
import {
  HEADER_WRITE_TOKEN,
  PATHS,
  RECOVERY_ENVELOPE_SIZE,
} from "./contract.ts";
import type { Bytes } from "../crypto/encoding.ts";

/** The fixed-size recovery-envelope body, or a protocol error (existence uniformity). */
function requireRecoverySize(body: Bytes): Bytes {
  if (body.length !== RECOVERY_ENVELOPE_SIZE) {
    throw new ApiError(
      "protocol",
      `recovery envelope was ${body.length} bytes`,
    );
  }
  return body;
}

export function recoveryMethods(
  call: (path: string, init?: RequestInit) => Promise<Response>,
): Pick<
  ApiClient,
  "getRecoveryEnvelope" | "putRecoveryEnvelope" | "deleteRecoveryEnvelope"
> {
  const at = (locator: string) =>
    PATHS.recoveryPrefix + encodeURIComponent(locator);
  return {
    async getRecoveryEnvelope(locator) {
      const res = await call(at(locator), { method: "GET", cache: "no-store" });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "recovery get");
      return requireRecoverySize(await readBytes(res));
    },
    async putRecoveryEnvelope(locator, envelope, writeToken) {
      if (envelope.length !== RECOVERY_ENVELOPE_SIZE) {
        throw new ApiError(
          "protocol",
          "recovery envelope must be the fixed size",
        );
      }
      const res = await call(at(locator), {
        method: "PUT",
        headers: {
          "Content-Type": OCTET_STREAM,
          [HEADER_WRITE_TOKEN]: writeToken,
        },
        body: envelope,
      });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "recovery put");
    },
    async deleteRecoveryEnvelope(locator, writeToken) {
      const res = await call(at(locator), {
        method: "DELETE",
        headers: { [HEADER_WRITE_TOKEN]: writeToken },
      });
      if (!res.ok)
        throw new ApiError(statusToKind(res.status), "recovery delete");
    },
  };
}
