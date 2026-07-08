/**
 * Passkey-backed key source (WebAuthn PRF). A passkey re-derives the same PRF
 * output for a fixed salt every time, so a key is never stored: it is re-minted
 * on demand from the authenticator. The credential id is non-secret and kept
 * locally.
 *
 * RECOVERY MODEL: the account root stays recoverable by the recovery PHRASE
 * (the one substitute for a lost passkey, per the data doc). This adapter only
 * yields the PRF output; auth/keyVault uses it to WRAP a phrase-derived root,
 * so the passkey is a second credential over the same account, never a standalone
 * one. Onboarding must never create a passkey-only account (an unrecoverable
 * lockout on passkey loss).
 *
 * The `navigator.credentials` calls are browser-only and cannot run in jsdom;
 * they are isolated behind {@link PasskeyAuth} so callers (and tests) depend on
 * the interface, and the byte handling and PRF→key derivation are the
 * unit-tested parts. The concrete adapter is proven end to end against a real
 * (virtual) authenticator by e2e/auth.pw.spec.ts (doc 38).
 */

import {
  bytesToBase64url,
  base64urlToBytes,
  bufferSourceToBytes,
  type Bytes,
} from "../crypto/index.ts";

/**
 * Why a passkey call failed, so the UI can say something true instead of a flat
 * "no passkey found". `cancelled`: the user dismissed the prompt, it timed out,
 * or the authenticator wasn't offered. `no-prf`: the authenticator authenticated
 * but returned no PRF result (some password managers, including some 1Password
 * builds, don't do PRF yet), so it can't unlock this account's key. `unavailable`:
 * WebAuthn isn't reachable, the origin/rpId didn't match, or another platform error.
 */
export type PasskeyFailureCode = "cancelled" | "no-prf" | "unavailable";

export class PasskeyError extends Error {
  readonly code: PasskeyFailureCode;
  constructor(code: PasskeyFailureCode, message?: string) {
    super(message ?? `passkey: ${code}`);
    this.name = "PasskeyError";
    this.code = code;
  }
}

// Map a thrown WebAuthn error to a failure code by its DOMException name (read
// defensively, since a DOMException is not always an Error instance). A user
// cancel, timeout, or "no credential offered" all surface as NotAllowedError;
// everything else is treated as a platform problem the user can't act on.
export function classifyWebAuthnError(err: unknown): PasskeyFailureCode {
  const name =
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    typeof err.name === "string"
      ? err.name
      : "";
  return name === "NotAllowedError" ||
    name === "AbortError" ||
    name === "TimeoutError"
    ? "cancelled"
    : "unavailable";
}

interface EnrolledPasskey {
  /** base64url of the credential rawId; non-secret, stored locally. */
  readonly credentialId: string;
  /** The PRF output, used to wrap/unwrap the account root (auth/keyVault). */
  readonly prfOutput: Bytes;
  /** Transport hints the authenticator reported at create, stored so a later
   * unlock can route back to the same provider (helps cross-platform managers
   * like 1Password get offered). Absent when the browser doesn't report them. */
  readonly transports?: AuthenticatorTransport[];
}

export interface PasskeyAuth {
  /**
   * Whether WebAuthn is present at all. PRF support is authenticator-dependent
   * and can't be feature-detected synchronously, so it is only confirmed at
   * enroll time (a missing PRF result throws PasskeyError("no-prf")); callers
   * must handle that.
   */
  available(): boolean;
  /** Create a passkey and return its PRF output. Throws {@link PasskeyError}. */
  enroll(userName: string): Promise<EnrolledPasskey>;
  /** Re-read the PRF output from an existing passkey, routing with the stored
   * transport hints when present. Throws {@link PasskeyError}. */
  unlock(
    credentialId: string,
    transports?: AuthenticatorTransport[],
  ): Promise<Bytes>;
}

// A fixed PRF evaluation input: the same passkey always returns the same PRF
// output for it, which is what makes the wrapping key stable and re-derivable.
const PRF_SALT = new TextEncoder().encode("sti.care/prf-salt/v1");
const RP_NAME = "sti.care";

function challenge(): Bytes {
  return crypto.getRandomValues(new Uint8Array(32));
}

// The transports an attestation reported, or undefined when the browser doesn't
// expose them. Stored at enroll so a later get() can hint routing back to the
// same provider (an empty list is treated as "unknown").
function reportedTransports(
  cred: PublicKeyCredential,
): AuthenticatorTransport[] | undefined {
  const resp = cred.response;
  if (
    resp instanceof AuthenticatorAttestationResponse &&
    typeof resp.getTransports === "function"
  ) {
    const list = resp.getTransports();
    if (list.length > 0) return list as AuthenticatorTransport[];
  }
  return undefined;
}

export function webAuthnPasskey(rpId?: string): PasskeyAuth {
  async function unlock(
    credentialId: string,
    transports?: AuthenticatorTransport[],
  ): Promise<Bytes> {
    let cred: PublicKeyCredential | null;
    try {
      cred = (await navigator.credentials.get({
        publicKey: {
          challenge: challenge(),
          allowCredentials: [
            {
              type: "public-key",
              id: base64urlToBytes(credentialId),
              // Hint routing back to the provider that holds this credential, so
              // a cross-platform manager (e.g. 1Password) is offered rather than
              // only the platform authenticator.
              ...(transports && transports.length > 0 ? { transports } : {}),
            },
          ],
          userVerification: "required",
          extensions: { prf: { eval: { first: PRF_SALT } } },
        },
      })) as PublicKeyCredential | null;
    } catch (err) {
      throw new PasskeyError(classifyWebAuthnError(err));
    }
    if (!cred) throw new PasskeyError("cancelled");
    const first = cred.getClientExtensionResults().prf?.results?.first;
    if (first === undefined) {
      throw new PasskeyError("no-prf");
    }
    return bufferSourceToBytes(first);
  }

  return {
    available() {
      return (
        typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined" &&
        typeof navigator !== "undefined"
      );
    },

    async enroll(userName) {
      let cred: PublicKeyCredential | null;
      try {
        cred = (await navigator.credentials.create({
          publicKey: {
            challenge: challenge(),
            rp: rpId ? { id: rpId, name: RP_NAME } : { name: RP_NAME },
            user: {
              id: crypto.getRandomValues(new Uint8Array(16)),
              name: userName,
              displayName: userName,
            },
            pubKeyCredParams: [
              { type: "public-key", alg: -7 },
              { type: "public-key", alg: -257 },
            ],
            // authenticatorAttachment is left unset on purpose: both platform and
            // cross-platform authenticators (1Password, a phone over hybrid) may
            // enroll. residentKey "required" makes the credential discoverable.
            authenticatorSelection: {
              residentKey: "required",
              userVerification: "required",
            },
            extensions: { prf: {} },
          },
        })) as PublicKeyCredential | null;
      } catch (err) {
        throw new PasskeyError(classifyWebAuthnError(err));
      }
      if (!cred) throw new PasskeyError("cancelled");
      const credentialId = bytesToBase64url(new Uint8Array(cred.rawId));
      const transports = reportedTransports(cred);
      // PRF output is not reliably returned at create across authenticators, so
      // read it via a follow-up get with the eval salt. This is also where a
      // no-PRF provider surfaces as PasskeyError("no-prf").
      const prfOutput = await unlock(credentialId, transports);
      return { credentialId, prfOutput, ...(transports ? { transports } : {}) };
    },

    unlock,
  };
}
