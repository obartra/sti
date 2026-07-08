import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";
import { VersionStamp } from "./VersionStamp.tsx";

// Centered canvas for the logged-out public + onboarding screens. Desktop shows
// a clickable wordmark header over a centered column; mobile just centers the
// screen. (The desktop a1 landing has its own full-page layout and bypasses
// this.) Styled by the layout layer (doc 37).
export function CanvasWrap({
  desktop,
  wide = false,
  full = false,
  focus = false,
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
  /** Desktop-only: compose a short form (the onboarding steps) in the viewport
   * height on a narrow column, instead of hugging the top of the reading
   * measure. No effect on mobile. */
  focus?: boolean;
  onHome?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <div className="l-surface">
      {desktop && (
        <header
          className={cx("l-canvas-header", full && "l-canvas-header--full")}
        >
          <button
            type="button"
            onClick={onHome}
            aria-label="sti.care home"
            className="l-canvas-brand"
          >
            <img src="/assets/logo/logo-wordmark.svg" alt="sti.care" />
          </button>
        </header>
      )}
      <main
        className={cx(
          "l-canvas-main",
          desktop && "l-canvas-main--desktop",
          full
            ? "l-canvas-main--full"
            : wide && desktop && "l-canvas-main--wide",
          focus && desktop && "l-canvas-main--focus",
        )}
      >
        {children}
        <VersionStamp />
      </main>
    </div>
  );
}
