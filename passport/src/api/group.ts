/**
 * The shared-group blob transport methods (doc 33, slice 2), split out of client.ts
 * to keep that file within its size budget (like the account, vanity, and recovery
 * groups). Same blind contract as an alias payload: the read is existence-uniform and
 * fixed-size (a decoy on a miss, discovered only when the crypto layer fails to open
 * it), and put/delete carry the write token that gates the write. The group id is an
 * opaque alias-shaped id.
 *
 * The blob is treated as OPAQUE fixed-size bytes here; its internal structure (the
 * group handle, the roster, the per-member wrapped group key) is a later slice.
 */

import {
  ApiError,
  OCTET_STREAM,
  readBytes,
  statusToKind,
  type ApiClient,
} from "./client.ts";
import {
  GROUP_BLOB_SIZE,
  HEADER_WRITE_TOKEN,
  PATHS,
  validId,
} from "./contract.ts";
import type { Bytes } from "../crypto/encoding.ts";

/** The fixed-size group-blob body, or a protocol error (existence uniformity). */
function requireGroupSize(body: Bytes): Bytes {
  if (body.length !== GROUP_BLOB_SIZE) {
    throw new ApiError("protocol", `group blob was ${body.length} bytes`);
  }
  return body;
}

export function groupMethods(
  call: (path: string, init?: RequestInit) => Promise<Response>,
): Pick<ApiClient, "getGroupBlob" | "putGroupBlob" | "deleteGroupBlob"> {
  const at = (id: string) => PATHS.groupPrefix + id;
  return {
    async getGroupBlob(id) {
      if (!validId(id)) throw new ApiError("badRequest", "malformed group id");
      const res = await call(at(id), { method: "GET", cache: "no-store" });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "group get");
      return requireGroupSize(await readBytes(res));
    },
    async putGroupBlob(id, blob, writeToken) {
      if (!validId(id)) throw new ApiError("badRequest", "malformed group id");
      if (blob.length !== GROUP_BLOB_SIZE) {
        throw new ApiError("protocol", "group blob must be the fixed size");
      }
      const res = await call(at(id), {
        method: "PUT",
        headers: {
          "Content-Type": OCTET_STREAM,
          [HEADER_WRITE_TOKEN]: writeToken,
        },
        body: blob,
      });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "group put");
    },
    async deleteGroupBlob(id, writeToken) {
      if (!validId(id)) throw new ApiError("badRequest", "malformed group id");
      const res = await call(at(id), {
        method: "DELETE",
        headers: { [HEADER_WRITE_TOKEN]: writeToken },
      });
      if (!res.ok) throw new ApiError(statusToKind(res.status), "group delete");
    },
  };
}
