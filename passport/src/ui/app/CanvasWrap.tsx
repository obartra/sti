import type { ReactNode } from "react";
import { VersionStamp } from "./VersionStamp.tsx";

// Centered canvas for the logged-out public + onboarding screens. Desktop shows
// a clickable wordmark header over a centered column; mobile just centers the
// screen. (The desktop a1 landing has its own full-page layout and bypasses
// this.) Faithful to the prototype's CanvasWrap intent.
export function CanvasWrap({
  desktop,
  wide = false,
  full = false,
  onHome,
  children,
}: {
  desktop: boolean;
  /** Let the content use the full desktop measure (e.g. the multi-column
   * promises page) instead of the narrow reading column onboarding wants. */
  wide?: boolean;
  /** Hand the full canvas width to the child and let it own its own centering
   * (the trust pages' "trust center" layout). Overrides `wide`. */
  full?: boolean;
  onHome?: (() => void) | undefined;
  children: ReactNode;
}) {
  const mainMax = full ? 1160 : wide && desktop ? 760 : 600;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        background: "var(--surface-app)",
      }}
    >
      {desktop && (
        <header
          style={{
            maxWidth: full ? 1160 : 1080,
            margin: "0 auto",
            padding: "22px 32px",
            display: "flex",
          }}
        >
          <button
            type="button"
            onClick={onHome}
            aria-label="sti.care home"
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
            }}
          >
            <img
              src="/assets/logo/logo-wordmark.svg"
              alt="sti.care"
              style={{ height: 30 }}
            />
          </button>
        </header>
      )}
      <main
        style={{
          maxWidth: mainMax,
          margin: "0 auto",
          padding: desktop ? "8px 20px 48px" : "24px 20px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {children}
        <VersionStamp />
      </main>
    </div>
  );
}
