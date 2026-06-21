// The single source of truth for the repo-scoped build version, shared by the app
// build (passport/vite.config.ts) and the promises report (build-promises.mjs) so
// they can never drift.
//
// Scheme: the git TAG carries only major.minor (e.g. `v0.1`). The PATCH is the
// number of commits since that tag, so it advances on every commit without
// re-tagging. On `main` the version is a clean `vMajor.Minor.Patch`; on any other
// branch it appends a syntax-safe branch name and the short sha, so a preview
// build is identifiable. One version covers both the backend and the frontend.

import { execSync } from "node:child_process";

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
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
 * The build version string. `vMajor.Minor.Patch` on main; on a branch,
 * `vMajor.Minor.Patch-<branch>-g<sha>`. Falls back to the short sha (then "dev")
 * when no `vMajor.Minor` tag is reachable or this isn't a git checkout.
 */
export function repoVersion() {
  let described;
  try {
    // --long always prints `tag-distance-gsha` (even at distance 0). The
    // match/exclude pair selects a vMAJOR.MINOR tag and skips any legacy
    // vMAJOR.MINOR.PATCH tag, so the distance is the patch.
    described = git(
      'describe --tags --long --match "v[0-9]*.[0-9]*" --exclude "v[0-9]*.[0-9]*.[0-9]*"',
    );
  } catch {
    // No vMAJOR.MINOR tag reachable (or a shallow checkout with no history):
    // fall back to the commit ref the CI sets, then a bare sha, then "dev".
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
  const version = `${tag}.${patch}`;
  const branch = currentBranch();
  if (branch === "main") return version;
  // Detached HEAD with no CI branch hint: identify by sha alone.
  if (branch === "HEAD") return `${version}-g${sha}`;
  return `${version}-${sanitizeBranch(branch)}-g${sha}`;
}
