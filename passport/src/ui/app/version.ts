// Repo-scoped version + build date, injected at build time (see vite.config.ts).
// One stamp for the whole repo (backend and frontend), shown discreetly in the
// app and on the deployed promises report.
export const APP_VERSION = __APP_VERSION__;
export const BUILD_DATE = __BUILD_DATE__;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "2026-06-18" -> "18 Jun 2026"; returns the input unchanged if it can't parse.
export function formatBuildDate(iso: string = BUILD_DATE): string {
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const name = MONTHS[month - 1];
  if (!year || !day || name === undefined) return iso;
  return `${String(day)} ${name} ${String(year)}`;
}

// "v0.1.7 · 18 Jun 2026" on main (vMajor.Minor.Patch, patch = commits since the
// tag); on a branch the build appends the branch name + short sha. The scheme
// lives in deploy/report-lib.mjs.
export function versionLabel(): string {
  return `${APP_VERSION} · ${formatBuildDate()}`;
}
