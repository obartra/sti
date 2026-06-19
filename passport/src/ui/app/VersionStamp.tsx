import { versionLabel } from "./version.ts";

// Discreet repo-scoped version + date, shown on the main pages so the running
// build is always traceable. Same stamp the promises report carries.
export function VersionStamp() {
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 11,
        color: "var(--text-subtle)",
        fontFamily: "var(--font-mono)",
        padding: "14px 0 6px",
        letterSpacing: "0.02em",
      }}
    >
      {versionLabel()}
    </div>
  );
}
