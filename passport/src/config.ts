/**
 * Runtime config. The api base defaults to production and is overridable at
 * build time with VITE_API_BASE_URL (e.g. http://127.0.0.1:8080 for local dev
 * against a server instance).
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "https://api.sti.care";
