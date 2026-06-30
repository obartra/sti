/**
 * Canonical user-facing strings that appear in more than one place and MUST stay
 * identical wherever they show (so a wording change lands everywhere and the copies
 * can never drift). Voice and tone follow labs/docs/21-voice-and-tone.md.
 *
 * Keep this list small: only strings whose consistency is load-bearing. Per-screen
 * copy stays in that screen's own COPY object.
 */

/**
 * The partner-notify prompt: the exact message a recent contact sees when someone
 * reports a positive. It shows as a push wake (service worker), an in-app
 * notification row, and the full Alert screen, and is previewed to the sender before
 * it goes out, so all four must read the same. Contentless by design: no who, no
 * what. See doc 13.
 */
export const PARTNER_NOTIFY_PROMPT = "A recent contact suggests getting tested";

/**
 * The call to action that invites a non-user (viewing a shared card or a looked-up
 * name) to start their own passport. One wording everywhere it appears.
 */
export const CREATE_ACCOUNT_CTA = "Create your own passport";

/**
 * The settings screen's name: its own title, the home quick-action label, and the
 * references to it from other screens. One source so a rename lands everywhere.
 * (Formerly "Privacy and sharing"; the rest of the app already calls it Settings.)
 */
export const SETTINGS_SCREEN_NAME = "Settings";
