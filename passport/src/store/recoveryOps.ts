/**
 * The recovery-password factor operations (doc 32): turning the optional password
 * on and off. These sit a layer above the AccountManager (which only persists the
 * chosen recovery name) and the ApiClient (which stores the envelope), the same
 * split findableOps uses for vanity names.
 *
 * The load-bearing constraint (doc 24): the session's root is a non-extractable
 * key, so a password envelope cannot be minted from it mid-session. Setting the
 * password therefore requires the recovery PHRASE, re-derives the raw root bytes
 * from it, verifies they name THIS account, wraps them under the password, and
 * stores the envelope. Nothing the server sees is derived from the password, and
 * the phrase stays the backstop.
 */

import {
  deriveRootKey,
  importRootKey,
  parseRecoveryPhrase,
  deriveAccountId,
  deriveAccountWriteToken,
  type Bytes,
} from "../crypto/index.ts";
import { normalizeVanityName, hasVanityNameShape } from "./vanityName.ts";

// The password-envelope crypto and the strength gate carry a bundled Argon2id WASM
// (hash-wasm) and the zxcvbn estimator. They are pulled in only when a password is
// actually set (a rare Settings action), so they load via dynamic import() and land
// in their own chunk rather than in the always-loaded app shell reached through the
// session controller (doc 22 precache budget).
const loadVault = () => import("../auth/passwordEnvelope.ts");
const loadStrength = () => import("../auth/passwordStrength.ts");
import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { OwnerSession, SessionController } from "./session.ts";

/**
 * How turning the password on resolved. Only "set" changes the session; the rest
 * leave it untouched so the caller can show a precise, honest message:
 * - `wrongPhrase`: the phrase was malformed or names a different account.
 * - `weakPassword`: the password did not pass the strength gate (defense in depth;
 *   the UI gates first).
 * - `nameUnavailable`: the recovery name is already taken by someone else's
 *   envelope (detected by reading back and failing to open our own).
 * - `error`: a transport or unexpected failure.
 */
type SetRecoveryPasswordOutcome =
  | "set"
  | "wrongPhrase"
  | "weakPassword"
  | "nameUnavailable"
  | "error";

export interface SetRecoveryPasswordResult {
  readonly session: OwnerSession;
  readonly outcome: SetRecoveryPasswordOutcome;
}

/** What turning the password on needs: the owner-chosen name, the password, and the
 * recovery phrase (to re-derive the non-extractable root, see the module note). */
export interface SetRecoveryPasswordInput {
  readonly name: string;
  readonly password: string;
  readonly phrase: string;
}

function bytesEqual(a: Bytes, b: Bytes): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

// Re-derive the raw root bytes from the phrase and confirm they name THIS account.
// Returns the bytes on a match, or null when the phrase is malformed or belongs to a
// different account (the owner mistyped or pasted the wrong one). Wrapping a
// mismatched root would store an envelope that opens to someone else's account.
async function verifyPhraseRoot(
  session: OwnerSession,
  phrase: string,
): Promise<Bytes | null> {
  const parsed = parseRecoveryPhrase(phrase);
  if (parsed === null) return null;
  const rootBytes = await deriveRootKey(parsed);
  const [phraseId, sessionId] = await Promise.all([
    deriveAccountId(await importRootKey(rootBytes)),
    deriveAccountId(session.root),
  ]);
  return phraseId === sessionId ? rootBytes : null;
}

// Confirm the recovery name now holds OUR envelope: fetch it back and check our
// password opens it to our root. On a locator collision the server's PUT was a
// silent no-op (doc 32), so the fetched envelope is someone else's and won't open,
// which is exactly how the owner learns the name is unavailable. Any failure here
// (a collision, or a transient read) is reported as unavailable so setup never
// falsely claims success.
async function confirmStored(
  api: ApiClient,
  locator: string,
  password: string,
  root: Bytes,
): Promise<boolean> {
  try {
    const vault = await loadVault();
    const fetched = await api.getRecoveryEnvelope(locator);
    const opened = await vault.unwrapPasswordEnvelope(
      vault.deserializeEnvelope(fetched),
      password,
    );
    return bytesEqual(opened, root);
  } catch {
    return false;
  }
}

/**
 * Turn the password factor on (or change it): wrap the account root under the
 * password and store the envelope at the owner-chosen recovery name, then record
 * that name in the account so it can be re-viewed and turned off. Requires the
 * recovery phrase (see the module note). Returns the outcome; only "set" advances
 * the session (to the blob carrying the new recovery name).
 */
export async function setRecoveryPassword(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  input: SetRecoveryPasswordInput,
): Promise<SetRecoveryPasswordResult> {
  const { name, password, phrase } = input;
  const locator = normalizeVanityName(name);
  if (!hasVanityNameShape(locator)) return { session, outcome: "error" };
  const { gradePassword } = await loadStrength();
  if (!gradePassword(password).ok) return { session, outcome: "weakPassword" };
  const rootBytes = await verifyPhraseRoot(session, phrase);
  if (rootBytes === null) return { session, outcome: "wrongPhrase" };

  const writeToken = await deriveAccountWriteToken(session.root);
  const stored = await wrapAndStore(api, {
    locator,
    rootBytes,
    password,
    writeToken,
  });
  if (stored !== "ok") return { session, outcome: stored };
  const blob = await accounts.setRecoveryName(session.root, locator);
  return { session: { root: session.root, blob }, outcome: "set" };
}

interface StoreEnvelopeArgs {
  readonly locator: string;
  readonly rootBytes: Bytes;
  readonly password: string;
  readonly writeToken: string;
}

// Wrap the root under the password, store it at the locator, and confirm it landed
// as ours (the collision check). "ok" on success; "error" on a transport failure;
// "nameUnavailable" when the read-back does not open to our root (a collision, doc 32).
async function wrapAndStore(
  api: ApiClient,
  { locator, rootBytes, password, writeToken }: StoreEnvelopeArgs,
): Promise<"ok" | "error" | "nameUnavailable"> {
  const vault = await loadVault();
  const envelope = vault.serializeEnvelope(
    await vault.wrapPasswordEnvelope(rootBytes, password),
  );
  try {
    await api.putRecoveryEnvelope(locator, envelope, writeToken);
  } catch {
    return "error";
  }
  return (await confirmStored(api, locator, password, rootBytes))
    ? "ok"
    : "nameUnavailable";
}

/**
 * Turn the password factor off: drop the stored envelope and clear the recovery
 * name from the account. A no-op (unchanged session) when no password is set. The
 * server delete is best-effort and existence-uniform, so a transient failure still
 * clears the local record; the phrase and passkey are untouched.
 */
export async function disableRecoveryPassword(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
): Promise<OwnerSession> {
  const name = session.blob.recoveryName;
  if (name === undefined) return session;
  const writeToken = await deriveAccountWriteToken(session.root);
  await api.deleteRecoveryEnvelope(name, writeToken).catch(() => undefined);
  const blob = await accounts.setRecoveryName(session.root, null);
  return { root: session.root, blob };
}

/**
 * The two recovery-factor controller methods, bound to the api + accounts, ready to
 * spread into the SessionController (mirroring how findableOps' methods are wired).
 */
export function recoveryControllerMethods(
  api: ApiClient,
  accounts: AccountManager,
): Pick<SessionController, "setRecoveryPassword" | "disableRecoveryPassword"> {
  return {
    setRecoveryPassword: (session, input) =>
      setRecoveryPassword(api, accounts, session, input),
    disableRecoveryPassword: (session) =>
      disableRecoveryPassword(api, accounts, session),
  };
}
