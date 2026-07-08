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

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
}

// The current branch. CI checkouts are often detached, so trust the CI env first
// (Netlify sets BRANCH, GitHub Actions sets GITHUB_REF_NAME), then ask git.
function currentBranch() {
  const fromEnv = process.env.BRANCH || process.env.GITHUB_REF_NAME;
  if (fromEnv) return fromEnv;
  try {
    return git("rev-parse --abbrev-ref HEAD");
  } catch {
    return "HEAD";
  }
}

// Fold a branch name into a semver-safe pre-release identifier: the spec allows
// only [0-9A-Za-z-], so slashes and other separators become hyphens.
function sanitizeBranch(name) {
  return name
    .replace(/[^0-9A-Za-z-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * The repo-scoped build version (one stamp for backend + frontend). The git TAG
 * carries only major.minor (e.g. `v0.1`); the PATCH is the number of commits since
 * it, so it advances on every commit without re-tagging. On `main` the version is
 * a clean `vMajor.Minor.Patch`; on any other branch it appends the (syntax-safe)
 * branch name and short sha so a preview build is identifiable. Falls back to the
 * commit ref / short sha / "dev" when no `vMajor.Minor` tag is reachable.
 */
export function version() {
  let described;
  try {
    // --long always prints `tag-distance-gsha` (even at distance 0). The match
    // selects the vMAJOR.MINOR tag, so the distance is the patch.
    described = git('describe --tags --long --match "v[0-9]*.[0-9]*"');
  } catch {
    const ref = process.env.COMMIT_REF || process.env.GITHUB_SHA;
    if (ref) return ref.slice(0, 7);
    try {
      return git("rev-parse --short HEAD");
    } catch {
      return "dev";
    }
  }
  const m = described.match(/^(v\d+\.\d+)-(\d+)-g([0-9a-f]+)$/);
  if (m === null) return described || "dev";
  const [, tag, patch, sha] = m;
  const semver = `${tag}.${patch}`;
  const branch = currentBranch();
  if (branch === "main") return semver;
  // Detached HEAD with no CI branch hint: identify by sha alone.
  if (branch === "HEAD") return `${semver}-g${sha}`;
  return `${semver}-${sanitizeBranch(branch)}-g${sha}`;
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
