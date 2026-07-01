/**
 * The password strength gate (doc 32, slice 2): a pure, client-only check that
 * REJECTS a weak password rather than scoring it. The optional password is the
 * account's weakest enabled factor once its envelope is stolen, so this gate holds
 * the floor for everyone who turns the password on; it is load-bearing, not polish.
 *
 * The floor is three checks, all on-device (no candidate ever leaves the device,
 * doc 32):
 *   1. a minimum length (and a sane maximum),
 *   2. a local common-password / breach wordlist (commonPasswords.ts),
 *   3. a zxcvbn estimate that must reach its strongest bucket (score 4).
 *
 * The estimator is @zxcvbn-ts/core (the pattern engine: keyboard walks, sequences,
 * repeats, dates, l33t) seeded with our compact common-password dictionary, instead
 * of the multi-megabyte full language pack, so it stays small enough for the lazy
 * recovery/settings chunk.
 *
 * The copy follows the voice guide (doc 21): it says plainly that a password is not
 * accepted and what to do, never blames the reader, and never describes how a weak
 * password could be attacked.
 */

import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { COMMON_PASSWORDS } from "./commonPasswords.ts";

/**
 * The minimum length. A short password is rejected before the estimator even runs.
 * A security constant: raise it deliberately. 10 is a floor under the estimator,
 * which does the nuanced work above it.
 */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * An upper bound, so the field cannot take a pathologically long input. The KDF cost
 * does not depend on length, so this is sanity, not security.
 */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * The estimator bucket a password must reach. zxcvbn scores 0..4; 4 is the strongest
 * bucket (doc 32, "an estimator threshold at its strongest bucket"). A security
 * constant.
 */
export const REQUIRED_ZXCVBN_SCORE = 4;

/**
 * The result of grading a candidate. On a reject, `reason` is user-facing copy (doc
 * 21) ready to show under the field; on a pass there is nothing to say.
 */
export type PasswordGrade =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

// One factory for the module, seeded once with our dictionary. zxcvbn lowercases,
// reverses, and l33t-matches against it, so the list need only hold base forms.
const zxcvbn = new ZxcvbnFactory({
  dictionary: { common: [...COMMON_PASSWORDS] },
});

const commonSet = new Set(COMMON_PASSWORDS);

/**
 * Grade a candidate password, rejecting anything weak. Pure and synchronous, so the
 * UI can call it on every keystroke. The checks run cheapest-first (length, then the
 * wordlist membership, then the estimator), each with its own honest reason.
 */
export function gradePassword(password: string): PasswordGrade {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Make it longer. Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `That is too long. Keep it under ${MAX_PASSWORD_LENGTH} characters.`,
    };
  }
  if (commonSet.has(password.toLowerCase())) {
    return {
      ok: false,
      reason:
        "That is one of the most common passwords. Pick something only you would think of.",
    };
  }
  if (zxcvbn.check(password).score < REQUIRED_ZXCVBN_SCORE) {
    return {
      ok: false,
      reason:
        "Pick something harder to guess. A few words you'll remember work well.",
    };
  }
  return { ok: true };
}
