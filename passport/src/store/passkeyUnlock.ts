/**
 * The passkey resume step, split out of session.ts: take this device's saved
 * binding and re-unlock the account root from the authenticator, tagging why it
 * failed so login can be honest (never a flat "no passkey found"). Kept here so
 * the controller file stays under its length ceiling and the unlock logic is
 * unit-tested on its own.
 */

import {
  base64urlToBytes,
  importRootKey,
  type Bytes,
  type RootKey,
} from "../crypto/index.ts";
import { unwrapRoot } from "../auth/keyVault.ts";
import {
  PasskeyError,
  type PasskeyAuth,
  type PasskeyFailureCode,
} from "../auth/passkey.ts";
import type { DeviceStore } from "../auth/deviceStore.ts";

/**
 * Why a passkey resume did not produce a session. `no-binding`: nothing saved on
 * this device (the honest "no passkey here, use your phrase"). `no-account`:
 * unlocked, but no account blob for that root. `mismatch`: the passkey
 * authenticated but its PRF did not unwrap the saved root (wrong passkey or
 * corrupt binding; the binding is left intact). The rest come straight from
 * {@link PasskeyFailureCode}.
 */
export type ResumeFailure =
  "no-binding" | "no-account" | "mismatch" | PasskeyFailureCode;

export type UnlockResult =
  | { readonly ok: true; readonly root: RootKey }
  | { readonly ok: false; readonly reason: ResumeFailure };

/**
 * Whether this device has a passkey binding at all (doc 32). A pure local read of
 * the device store, no authenticator prompt, so the UI can decide up front whether
 * a passkey gate applies before it ever asks for a presence check.
 */
export function hasPasskeyBinding(devices: DeviceStore): boolean {
  return devices.load() !== null;
}

/**
 * A lightweight "confirm it's you" presence check against the enrolled passkey
 * (doc 32): run the WebAuthn assertion with the saved credential (user
 * verification / biometric), and resolve true only when it succeeds. It does NOT
 * unwrap the root, import a key, or touch the live session: the PRF output is read
 * and immediately discarded, so this is a yes/no presence gate, never a re-unlock.
 * Returns false when no passkey is bound here or the assertion is cancelled /
 * unavailable, so the caller keeps the phrase hidden with a plain retry message.
 */
export async function verifyPasskeyPresence(
  devices: DeviceStore,
  passkey: PasskeyAuth,
): Promise<boolean> {
  const cred = devices.load();
  if (cred === null) return false;
  try {
    // The assertion IS the gate: a successful get() means the authenticator
    // verified the user (presence + user verification is "required"). The PRF
    // output it returns is deliberately ignored here, so the session's root is
    // never re-derived and the unlocked session is never disturbed.
    await passkey.unlock(cred.credentialId, cred.transports);
    return true;
  } catch {
    return false;
  }
}

// Unlock the root from this device's passkey binding, tagging why it failed.
// `no-binding` when nothing is saved here; a PasskeyError's code when the get()
// failed (cancelled / unavailable / no-prf); `mismatch` when unlock succeeded but
// the saved root did not unwrap (GCM rejects). The binding is left intact on
// failure, so a later correct unlock still works.
export async function unlockRoot(
  devices: DeviceStore,
  passkey: PasskeyAuth,
): Promise<UnlockResult> {
  const cred = devices.load();
  if (cred === null) return { ok: false, reason: "no-binding" };
  let prfOutput: Bytes;
  try {
    prfOutput = await passkey.unlock(cred.credentialId, cred.transports);
  } catch (err) {
    const reason: ResumeFailure =
      err instanceof PasskeyError ? err.code : "unavailable";
    return { ok: false, reason };
  }
  try {
    // PRF unwrap yields the transient root key bytes; import them once into the
    // non-extractable key (doc 24) and drop the bytes.
    const bytes = await unwrapRoot(
      base64urlToBytes(cred.wrappedRoot),
      prfOutput,
    );
    return { ok: true, root: await importRootKey(bytes) };
  } catch {
    return { ok: false, reason: "mismatch" };
  }
}
