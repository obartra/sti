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

// The abuse / hate blocklist is NOT a client concern. The server holds the single
// authoritative, hate-only list (server/internal/vanityname) and answers a blocked
// name with a 409, so the client never ships its own divergent list. The client's
// instant check is charset + length + reserved only; the server is the source of
// truth for what is blocked. A client-side scam/phishing list (the old BLOCKED_NAMES)
// did not overlap the server's and risked pushing the app's own audience (identity /
// health / sexual terms) out of the namespace, so it was removed (doc 17).

// Normalize input to the canonical form names are stored and compared in: trim
// surrounding whitespace, lowercase. Shape validation still rejects anything that
// is not [a-z0-9_]; normalization only folds case and trims, it does not strip.
export function normalizeVanityName(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Why a (normalized) name fails the instant client check, or null when it passes.
 * There is no "blocked" reason: the hate blocklist is server-authoritative (a 409 at
 * registration), so the client only judges charset, length, and the reserved set.
 */
export type VanityNameError =
  "too-short" | "too-long" | "bad-chars" | "reserved";

/**
 * The instant client check: returns the first failing reason or null. Operates on the
 * normalized form, so callers should normalize first (this normalizes again,
 * defensively, so a raw value is also handled safely). It deliberately does NOT judge
 * whether a name is blocked for abuse; that is the server's call (the 409 path).
 */
export function vanityNameError(input: string): VanityNameError | null {
  const name = normalizeVanityName(input);
  if (name.length < MIN_VANITY_LEN) return "too-short";
  if (name.length > MAX_VANITY_LEN) return "too-long";
  if (!NAME_SHAPE.test(name)) return "bad-chars";
  if (RESERVED_NAMES.has(name)) return "reserved";
  return null;
}

/** Whether a name passes the instant client check (shape + length + not reserved). */
export function isValidVanityName(input: string): boolean {
  return vanityNameError(input) === null;
}

/**
 * Whether a value is a well-shaped vanity name (charset + length only), ignoring
 * the reserved/blocked sets. Used to validate a name PERSISTED in the account blob:
 * the charset is fixed, but the reserved/blocked sets grow over time, so validating
 * a stored name against them would brick an account that registered a name later
 * added to the blocklist (blob parse fails closed). Shape is the stable invariant.
 */
export function hasVanityNameShape(x: unknown): x is string {
  return typeof x === "string" && NAME_SHAPE.test(x);
}
