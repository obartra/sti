import {
  deriveMasterKey,
  importMasterKey,
  type AppGeneratedPhrase,
  type MasterKey,
} from "../crypto/index.ts";

// Test-only: brand an arbitrary string as a recovery phrase so a test can exercise
// deriveMasterKey / account derivation with fixed inputs. Production code must NOT
// brand this way: it uses randomRecoveryPhrase (signup) or parseRecoveryPhrase
// (recovery, which validates the app format). This helper is the deliberate,
// review-visible escape hatch the AppGeneratedPhrase brand is meant to force.
export function phraseForTest(s: string): AppGeneratedPhrase {
  return s as AppGeneratedPhrase;
}

// Test-only: the non-extractable MasterKey for a fixed phrase, mirroring the
// production sign-in path (deriveMasterKey -> importMasterKey, doc 24). The store
// layers take a MasterKey, so tests that drive them get the key through here.
export async function masterForTest(s: string): Promise<MasterKey> {
  return importMasterKey(await deriveMasterKey(phraseForTest(s)));
}

// Test-only: a synchronous placeholder MasterKey for UI/hook tests that stub the
// whole controller and never derive from the master (they treat it opaquely). A
// real CryptoKey can only be made async, so this casts a marker object; never use
// it where the key is actually exercised (use masterForTest for that).
export function fakeMasterKey(): MasterKey {
  return { __fakeMasterKey: true } as unknown as MasterKey;
}
