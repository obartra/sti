import type { AppGeneratedPhrase } from "../crypto/index.ts";

// Test-only: brand an arbitrary string as a recovery phrase so a test can exercise
// deriveMasterKey / account derivation with fixed inputs. Production code must NOT
// brand this way: it uses randomRecoveryPhrase (signup) or parseRecoveryPhrase
// (recovery, which validates the app format). This helper is the deliberate,
// review-visible escape hatch the AppGeneratedPhrase brand is meant to force.
export function phraseForTest(s: string): AppGeneratedPhrase {
  return s as AppGeneratedPhrase;
}
