// The local display name (owner-facing only, never sent to the server). Unlike a
// handle it reads as a real name, so mixed case and spaces are welcome. Because it
// lives on-device and is never a public identifier, the homograph and impersonation
// worries that force the handle charset to be narrow do not apply here, so the policy
// is permissive: letters of any script, combining marks, digits, spaces, and a few
// name punctuation marks (apostrophe, period, hyphen). Control, zero-width, and
// bidi-control characters are stripped so a pasted name cannot smuggle invisible or
// direction-flipping payloads, and the length is capped so the name fits the surfaces
// that greet the owner by it.

export const MAX_DISPLAY_NAME = 40;

const ALLOWED = /[^\p{L}\p{M}\p{N} '.-]/gu;

// As-you-type sanitize: drop disallowed characters and collapse runs of whitespace to
// a single space, but do not trim, so a space between words survives while typing. NFC
// normalize so composed and decomposed forms compare and store consistently. Capped by
// code point (not UTF-16 unit) so the limit never splits a surrogate pair.
export function sanitizeDisplayName(raw: string): string {
  // Collapse whitespace runs (tabs and newlines included) to a single space first, so
  // a pasted line break between words becomes a space rather than being dropped, then
  // strip everything outside the allowed set (emoji, symbols, control, zero-width, and
  // bidi characters).
  const cleaned = raw
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(ALLOWED, "");
  return Array.from(cleaned).slice(0, MAX_DISPLAY_NAME).join("");
}

// The value to store: the sanitized name with the ends trimmed. Empty means no name.
export function normalizeDisplayName(raw: string): string {
  return sanitizeDisplayName(raw).trim();
}

// Derive a valid handle candidate from a display name, matching the handle shape
// (lowercase letters, digits, underscore, length 3 to 30). The display name is
// internal and never shared with anyone; a handle is. This reduction is the bridge:
// it seeds the default for a person's first handle, and it is what the owner's "show
// my name" card stamps, so the raw display name (mixed case, spaces, punctuation)
// never reaches a viewer. Diacritics fold to their base letter ("jose" from "José"),
// spaces become underscores, and anything else is dropped. Returns "" when nothing
// usable remains (for example a non-latin script), so callers fall back to the
// id-derived face rather than an invalid handle.
export function handleFromDisplayName(raw: string): string {
  const reduced = raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return reduced.length >= 3 ? reduced : "";
}
