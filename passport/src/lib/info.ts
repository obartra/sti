/**
 * The STI education library lives on its own static subdomain (doc 34); the app
 * links out to it rather than shipping it. The base is overridable at build time
 * with VITE_INFO_BASE_URL (e.g. to point at a preview deploy of the info site).
 */
const INFO_BASE_URL: string =
  import.meta.env.VITE_INFO_BASE_URL ?? "https://info.sti.care";

/**
 * Absolute URL for a page on the info site. A missing or bare path resolves to the
 * library index; a condition id (e.g. "gonorrhea") maps to its explainer.
 */
export function infoUrl(path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${INFO_BASE_URL}${suffix}`;
}
