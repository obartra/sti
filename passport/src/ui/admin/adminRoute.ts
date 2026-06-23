/**
 * The admin surface is reached at the dedicated path /admin (doc 20), served by
 * the SPA fallback like any other route. It is a full takeover, isolated from the
 * consumer app's screen graph and never linked from it, so it is matched by
 * pathname here rather than added to the routed Screen union.
 */
export function isAdminPath(): boolean {
  if (typeof window === "undefined") return false;
  return /^\/admin\/?$/.test(window.location.pathname);
}
