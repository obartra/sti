import type { ReactElement } from "react";

/**
 * The quiet knock indicator (doc 02): a small dot on the notifications bell when
 * the owner has pending knocks. No count, no per-knock detail — just "there's
 * something to look at." Render inside a `position: relative` wrapper around the
 * bell icon. Shared by the mobile and desktop shells.
 */
export function KnockDot(): ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--accent-base, #4f7cff)",
        border: "1.5px solid var(--surface-app, #fff)",
      }}
    />
  );
}
