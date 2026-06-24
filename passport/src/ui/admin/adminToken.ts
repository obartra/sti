/**
 * Where the admin bearer lives in the browser (doc 20): sessionStorage, so it is
 * cleared when the tab closes. Never localStorage (would outlive the session) and
 * never a cookie (no CSRF surface; the admin api is bearer-only and sets no
 * cookies). Every access is guarded so a context without sessionStorage degrades
 * to "no token" rather than throwing.
 */

const KEY = "sti.admin.token";

// Each access goes through try/catch: in a context without sessionStorage the
// property is either undefined (so .getItem throws a TypeError) or a getter that
// throws (private mode), and both land as "no token" rather than an exception.
export function readAdminToken(): string | null {
  try {
    return globalThis.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string): void {
  try {
    globalThis.sessionStorage.setItem(KEY, token);
  } catch {
    // sessionStorage unavailable: the token just won't persist across reloads.
  }
}

export function clearAdminToken(): void {
  try {
    globalThis.sessionStorage.removeItem(KEY);
  } catch {
    // best-effort; nothing to clean up if storage is unavailable.
  }
}
