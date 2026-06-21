// Shared helpers for the static report generators (build-promises.mjs and
// build-behaviors.mjs): the build stamp and HTML escaping, kept in one place so
// the two reports cannot drift (e.g. a fix to esc lands in both). Stdlib only.
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// The repo-scoped build identifier, with a Netlify shallow-checkout fallback.
export function version() {
  try {
    return execSync("git describe --tags --always --dirty", {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    const ref = process.env.COMMIT_REF;
    return ref ? ref.slice(0, 7) : "dev";
  }
}

export function today() {
  const d = new Date();
  return `${String(d.getDate())} ${MONTHS[d.getMonth()]} ${String(d.getFullYear())}`;
}

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
