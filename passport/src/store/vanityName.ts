/**
 * Vanity-name rules (doc 17), the namespace gate items 1-2. Pure, shared logic
 * for the future Findable mode: a name's charset, normalization, length, and the
 * reserved set. The server enforces the same rules at registration and the client
 * checks them before asking, so this is the single source of truth for both.
 *
 * Findable is not built yet; nothing calls this until the directory + resolve
 * endpoint land. It carries no status, no key, no identity, only the rules a name
 * must pass to be claimable.
 */

// Allowed name shape: lowercase letters, digits, underscore; length 3 to 30. No
// Unicode (removes homoglyph / confusable attacks at the namespace level).
const NAME_SHAPE = /^[a-z0-9_]{3,30}$/;
export const MIN_VANITY_LEN = 3;
export const MAX_VANITY_LEN = 30;

/**
 * Operational / official-impersonation terms that are unclaimable (doc 17). Brand
 * and service words, so a name cannot masquerade as sti.care or its staff. A
 * starter set, grown by report-and-takedown; kept lowercase to match normalized
 * input.
 */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "sys",
  "official",
  "staff",
  "team",
  "mod",
  "moderator",
  "support",
  "help",
  "helpdesk",
  "contact",
  "info",
  "abuse",
  "security",
  "legal",
  "privacy",
  "billing",
  "payments",
  "api",
  "app",
  "www",
  "mail",
  "email",
  "noreply",
  "no_reply",
  "sti",
  "sticare",
  "care",
  "health",
  "clinic",
  "verify",
  "verified",
  "test",
  "null",
  "undefined",
]);

/**
 * Abuse / impersonation blocklist (slurs, harassment terms). Deliberately empty
 * here: doc 17 keeps the contents out of source-controlled design text and grows
 * the list reactively via report-and-takedown. The check is wired so the list can
 * be populated (or sourced) without touching callers.
 */
export const BLOCKED_NAMES: ReadonlySet<string> = new Set([
  // Scam / impersonation bait, the part we can responsibly hand-author. The
  // slur / harassment portion is deliberately NOT hand-rolled here: before
  // Findable launches, seed it from a maintained moderation wordlist (e.g. the
  // LDNOOBW list or the npm `obscenity` package) so it stays current and is not a
  // partial, opinionated list baked into source. Grown reactively by
  // report-and-takedown (doc 17).
  "scam",
  "phishing",
  "phish",
  "fraud",
  "spam",
  "malware",
  "giveaway",
  "freemoney",
  "imposter",
  "impostor",
]);

// Normalize input to the canonical form names are stored and compared in: trim
// surrounding whitespace, lowercase. Shape validation still rejects anything that
// is not [a-z0-9_]; normalization only folds case and trims, it does not strip.
export function normalizeVanityName(input: string): string {
  return input.trim().toLowerCase();
}

/** Why a (normalized) name is not claimable, or null when it is valid. */
export type VanityNameError =
  | "too-short"
  | "too-long"
  | "bad-chars"
  | "reserved"
  | "blocked";

/**
 * Validate a name, returning the first failing reason or null. Operates on the
 * normalized form, so callers should normalize first (this normalizes again,
 * defensively, so a raw value is also handled safely).
 */
export function vanityNameError(input: string): VanityNameError | null {
  const name = normalizeVanityName(input);
  if (name.length < MIN_VANITY_LEN) return "too-short";
  if (name.length > MAX_VANITY_LEN) return "too-long";
  if (!NAME_SHAPE.test(name)) return "bad-chars";
  if (RESERVED_NAMES.has(name)) return "reserved";
  if (BLOCKED_NAMES.has(name)) return "blocked";
  return null;
}

/** Whether a name is claimable (shape + length + not reserved/blocked). */
export function isValidVanityName(input: string): boolean {
  return vanityNameError(input) === null;
}
