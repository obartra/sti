import type { ReactElement } from "react";
import "./app-shell.css";

/**
 * The quiet knock indicator (doc 02): a small dot on the notifications bell when
 * the owner has pending knocks. No count, no per-knock detail; just "there's
 * something to look at." Render inside the `.app-bell` relative wrapper around
 * the bell icon. Shared by the mobile and desktop shells. Styled by
 * app-shell.css; the old inline version pointed at a token that never existed
 * and always rendered its off-brand fallback blue.
 */
export function KnockDot(): ReactElement {
  return <span aria-hidden="true" className="app-knock-dot" />;
}
