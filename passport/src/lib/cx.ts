/** Join class names, skipping falsy parts. The app-side twin of the private
 * helper inside the vendored design components, shared so editorial pieces
 * and migrated screens compose classes the same way. */
export const cx = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" ");
