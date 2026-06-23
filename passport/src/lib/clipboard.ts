/**
 * Copy text to the clipboard, robustly. The async Clipboard API is the happy
 * path, but it is absent or blocked in plenty of real contexts the app runs in
 * (an insecure-origin device test over the LAN, some in-app webviews, older
 * Safari), where a bare `navigator.clipboard.writeText` silently does nothing.
 * So we fall back to a hidden-textarea `execCommand("copy")`, which works there.
 *
 * Returns whether a copy path was taken, so callers only flash "Copied" when it
 * actually had a chance to land (the async write is fire-and-forget, treated as
 * success once the API is present, since it resolves after this returns).
 */

// The synchronous fallback for contexts where navigator.clipboard is absent or
// blocked: a hidden textarea + execCommand.
function execCommandCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // execCommand is deprecated but remains the only sync copy fallback, and runs
    // exactly where the async Clipboard API isn't available, so keep it.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function copyText(text: string): boolean {
  try {
    // Typed present by the DOM lib but actually absent in some webviews, so treat
    // it as optional and fall through when it isn't there.
    const clip: Clipboard | undefined =
      typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (clip) {
      void clip.writeText(text).catch(() => undefined);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  return execCommandCopy(text);
}
