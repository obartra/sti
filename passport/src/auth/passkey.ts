/**
 * Passkey-backed key source (WebAuthn PRF). A passkey re-derives the same PRF
 * output for a fixed salt every time, so a key is never stored: it is re-minted
 * on demand from the authenticator. The credential id is non-secret and kept
 * locally.
 *
 * RECOVERY MODEL (must hold when this is wired into onboarding): the account
 * master must stay recoverable by the recovery PHRASE, which the data doc makes
 * the one substitute for a lost passkey. So onboarding must NOT create a
 * passkey-only account; the PRF must unlock the SAME account a phrase recovers,
 * e.g. by using the PRF output to wrap (encrypt) a phrase-derived/random master
 * rather than to derive a standalone master. A passkey-only account is an
 * unrecoverable lockout on passkey loss.
 *
 * The `navigator.credentials` calls are browser-only and cannot run in the test
 * harness; they are isolated behind {@link PasskeyAuth} so callers (and tests)
 * depend on the interface, and the byte handling and PRF→key derivation are the
 * unit-tested parts. The concrete adapter needs verification in a real browser
 * with an authenticator.
 */

import {
  masterFromPrf,
  bytesToBase64url,
  base64urlToBytes,
  bufferSourceToBytes,
  type Bytes,
} from "../crypto/index.ts";

export interface EnrolledPasskey {
  /** base64url of the credential rawId; non-secret, stored locally. */
  readonly credentialId: string;
  readonly master: Bytes;
}

export interface PasskeyAuth {
  /**
   * Whether WebAuthn is present at all. PRF support is authenticator-dependent
   * and can't be feature-detected synchronously, so it is only confirmed at
   * enroll time (a missing PRF result throws); callers must handle that.
   */
  available(): boolean;
  /** Create a passkey and mint the master key. */
  enroll(userName: string): Promise<EnrolledPasskey>;
  /** Re-mint the master from an existing passkey. */
  unlock(credentialId: string): Promise<Bytes>;
}

// A fixed PRF evaluation input: the same passkey always returns the same PRF
// output for it, which is what makes the master stable and re-derivable.
const PRF_SALT = new TextEncoder().encode("sti.care/prf-salt/v1");
const RP_NAME = "sti.care";

function challenge(): Bytes {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function webAuthnPasskey(rpId?: string): PasskeyAuth {
  async function unlock(credentialId: string): Promise<Bytes> {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        allowCredentials: [
          { type: "public-key", id: base64urlToBytes(credentialId) },
        ],
        userVerification: "required",
        extensions: { prf: { eval: { first: PRF_SALT } } },
      },
    })) as PublicKeyCredential | null;
    if (!cred) throw new Error("passkey: unlock cancelled");
    const first = cred.getClientExtensionResults().prf?.results?.first;
    if (first === undefined) {
      throw new Error("passkey: authenticator returned no PRF result");
    }
    return masterFromPrf(bufferSourceToBytes(first));
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
      const cred = (await navigator.credentials.create({
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
          authenticatorSelection: {
            residentKey: "required",
            userVerification: "required",
          },
          extensions: { prf: {} },
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("passkey: enrollment cancelled");
      const credentialId = bytesToBase64url(new Uint8Array(cred.rawId));
      // PRF output is not reliably returned at create across authenticators, so
      // read it via a follow-up get with the eval salt.
      return { credentialId, master: await unlock(credentialId) };
    },

    unlock,
  };
}
