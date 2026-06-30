import {
  deriveRootKey,
  importRootKey,
  type AppGeneratedPhrase,
  type RootKey,
} from "../crypto/index.ts";

// Test-only: brand an arbitrary string as a recovery phrase so a test can exercise
// deriveRootKey / account derivation with fixed inputs. Production code must NOT
// brand this way: it uses randomRecoveryPhrase (signup) or parseRecoveryPhrase
// (recovery, which validates the app format). This helper is the deliberate,
// review-visible escape hatch the AppGeneratedPhrase brand is meant to force.
export function phraseForTest(s: string): AppGeneratedPhrase {
  return s as AppGeneratedPhrase;
}

// Test-only: the non-extractable RootKey for a fixed phrase, mirroring the
// production sign-in path (deriveRootKey -> importRootKey, doc 24). The store
// layers take a RootKey, so tests that drive them get the key through here.
export async function rootForTest(s: string): Promise<RootKey> {
  return importRootKey(await deriveRootKey(phraseForTest(s)));
}

// Test-only: a synchronous placeholder RootKey for UI/hook tests that stub the
// whole controller and never derive from the root (they treat it opaquely). A
// real CryptoKey can only be made async, so this casts a marker object; never use
// it where the key is actually exercised (use rootForTest for that).
export function fakeRootKey(): RootKey {
  return { __fakeRootKey: true } as unknown as RootKey;
}
