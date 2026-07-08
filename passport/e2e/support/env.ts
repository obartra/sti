// The origins globalSetup booted for this run, read from the environment it set.
// Failing loud here beats a spec timing out against a blank origin when a spec is
// run outside `npm run test:e2e` (which wires the global setup).
function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(
      `${name} is unset; run via \`npm run test:e2e\` so globalSetup boots the app`,
    );
  }
  return v;
}

export function previewOrigin(): string {
  return required("E2E_PREVIEW_ORIGIN");
}

export function apiBase(): string {
  return required("E2E_API_BASE");
}
