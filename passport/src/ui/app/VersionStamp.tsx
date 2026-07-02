import { versionLabel } from "./version.ts";

// Discreet repo-scoped version + date, shown on the main pages so the running
// build is always traceable. Same stamp the promises report carries.
export function VersionStamp() {
  return <div className="l-stamp">{versionLabel()}</div>;
}
