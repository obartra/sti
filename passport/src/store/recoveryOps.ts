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
  type RootKey,
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
export type SetRecoveryPasswordOutcome =
  "set" | "wrongPhrase" | "weakPassword" | "nameUnavailable" | "error";

/**
 * How wrapping + storing the envelope resolved, shared by the Settings path (which
 * re-derives the root from the phrase) and the sign-up path (which already holds the
 * in-memory root). It is the subset of {@link SetRecoveryPasswordOutcome} that the
 * shared crypto core can produce; the phrase-specific `wrongPhrase` is the caller's
 * concern, not this helper's.
 */
type StoreRecoveryEnvelopeOutcome =
  "stored" | "weakPassword" | "nameUnavailable" | "error";

/**
 * The optional password factor chosen AT sign-up (doc 32): a public handle
 * (`recoveryName`, the envelope locator) plus a password. When present, create wraps
 * the freshly generated root under the password on the spot (the raw bytes are still
 * in hand, so no phrase re-entry) and records the name in the fresh blob. The account
 * is created and phrase/passkey-recoverable regardless of whether this step succeeds.
 */
export interface SignUpRecovery {
  readonly recoveryName: string;
  readonly password: string;
}

/**
 * How the optional sign-up password step resolved, alongside the always-created
 * account. `undefined` when no password was requested. `"set"` when the envelope
 * landed and the name was recorded; the rest mean the account exists but no password
 * was set, so the UI can steer the owner to retry or skip:
 * - `"nameUnavailable"`: the handle is taken by someone else's envelope (doc 32's
 *   silent-collision, caught by reading back and failing to open our own).
 * - `"weakPassword"`: the password failed the strength gate (the UI gates first).
 * - `"error"`: a transport or unexpected failure wrapping/storing the envelope.
 */
export type SignUpRecoveryOutcome =
  "set" | "nameUnavailable" | "weakPassword" | "error";

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
 * The shared crypto core (doc 32): grade the password, wrap the in-hand root bytes
 * under it, store the envelope at the locator named by the owner's public handle,
 * and confirm the write landed as ours (the collision check). Both the Settings path
 * (root re-derived from the phrase) and the sign-up path (root still in memory) call
 * this so the wrap/store/confirm sequence exists once, never duplicated.
 *
 * The caller supplies `rootBytes` (transient raw root, doc 24) and `root` (the
 * non-extractable session key, only to derive the account's write token). It never
 * records the recovery name; that write is the caller's, since sign-up folds it into
 * the fresh blob while Settings persists it separately. On "stored" the envelope is
 * live and openable by this password at `locator`.
 */
async function storeRecoveryEnvelope(
  api: ApiClient,
  args: {
    readonly locator: string;
    readonly rootBytes: Bytes;
    readonly root: RootKey;
    readonly password: string;
  },
): Promise<StoreRecoveryEnvelopeOutcome> {
  const { locator, rootBytes, root, password } = args;
  if (!hasVanityNameShape(locator)) return "error";
  const { gradePassword } = await loadStrength();
  if (!gradePassword(password).ok) return "weakPassword";
  const writeToken = await deriveAccountWriteToken(root);
  const stored = await wrapAndStore(api, {
    locator,
    rootBytes,
    password,
    writeToken,
  });
  return stored === "ok" ? "stored" : stored;
}

/**
 * The at-sign-up password path (doc 32): normalize + shape-check the chosen Username,
 * then wrap the in-memory root under the password and store the envelope at it (via
 * the shared {@link storeRecoveryEnvelope}). Returns the normalized name to record in
 * the fresh blob on success, or null when the optional step did not land, plus the
 * outcome. The caller (account.create) folds a non-null name into the same blob write
 * and always creates the account regardless of the outcome (the account stays phrase/
 * passkey-recoverable). The rootBytes are the caller's to drop after this returns.
 */
export async function wrapSignUpRecovery(
  api: ApiClient,
  args: {
    readonly rootBytes: Bytes;
    readonly root: RootKey;
    readonly recovery: SignUpRecovery;
  },
): Promise<{ recoveryName: string | null; outcome: SignUpRecoveryOutcome }> {
  const { rootBytes, root, recovery } = args;
  const locator = normalizeVanityName(recovery.recoveryName);
  if (!hasVanityNameShape(locator))
    return { recoveryName: null, outcome: "error" };
  const stored = await storeRecoveryEnvelope(api, {
    locator,
    rootBytes,
    root,
    password: recovery.password,
  });
  return stored === "stored"
    ? { recoveryName: locator, outcome: "set" }
    : { recoveryName: null, outcome: stored };
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
  // Re-derive the raw root from the phrase (the session root is non-extractable,
  // doc 24) and prove the phrase names THIS account before wrapping.
  const rootBytes = await verifyPhraseRoot(session, phrase);
  if (rootBytes === null) return { session, outcome: "wrongPhrase" };

  const stored = await storeRecoveryEnvelope(api, {
    locator,
    rootBytes,
    root: session.root,
    password,
  });
  if (stored !== "stored") return { session, outcome: stored };
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
 * New-device unlock (doc 32): fetch the envelope named by the recovery name, open it
 * with the password to recover the account root, and load the account. Returns the
 * session, or null on ANY failure (unknown name, wrong password, no account), so the
 * login form shows one uniform "didn't match" message and never distinguishes them.
 */
export async function recoverByPassword(
  api: ApiClient,
  accounts: AccountManager,
  name: string,
  password: string,
): Promise<OwnerSession | null> {
  const locator = normalizeVanityName(name);
  if (!hasVanityNameShape(locator)) return null;
  try {
    const vault = await loadVault();
    const fetched = await api.getRecoveryEnvelope(locator);
    const rootBytes = await vault.unwrapPasswordEnvelope(
      vault.deserializeEnvelope(fetched),
      password,
    );
    const root = await importRootKey(rootBytes);
    const blob = await accounts.loadByRoot(root);
    if (blob === null) return null;
    // Enforce link expiry on load like the other sign-in paths (doc 16), best-effort.
    const swept = await accounts.sweepExpiredLinks(root).catch(() => blob);
    return { root, blob: swept };
  } catch {
    return null;
  }
}

/**
 * The recovery-factor controller methods, bound to the api + accounts, ready to spread
 * into the SessionController (mirroring how findableOps' methods are wired).
 */
export function recoveryControllerMethods(
  api: ApiClient,
  accounts: AccountManager,
): Pick<
  SessionController,
  "setRecoveryPassword" | "disableRecoveryPassword" | "recoverByPassword"
> {
  return {
    setRecoveryPassword: (session, input) =>
      setRecoveryPassword(api, accounts, session, input),
    disableRecoveryPassword: (session) =>
      disableRecoveryPassword(api, accounts, session),
    recoverByPassword: (name, password) =>
      recoverByPassword(api, accounts, name, password),
  };
}
