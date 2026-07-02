import type { ReactNode } from "react";
import { Back } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import { useMinWidth } from "../desktop/Desktop.tsx";
import { NavLink } from "../app/NavLink.tsx";
import { pathForScreen } from "../app/useAppRouter.ts";
import type { Screen } from "../app/routes.ts";
import { TrustFooter, type TrustFooterProps } from "./TrustFooter.tsx";
import "./trust-shell.css";

// Shared shell for the public trust pages (promises, privacy, terms, share-link).
//
// On a large screen the page is a "trust center": a sticky left rail (back + the
// four trust destinations, current one lit) beside a wide content column, the
// whole thing centered in a comfortable measure so the content is never a lonely
// strip in a sea of margin. Below the rail breakpoint it collapses to the original
// single reading column with the footer carrying cross-navigation. Pure/static.

type TrustScreen = "promises" | "privacy" | "terms" | "share-link";

export interface TrustShellProps extends TrustFooterProps {
  /** The rail item to light, or undefined for a shell page with no rail entry
   * (the "Something wrong?" form, doc 35). */
  current?: TrustScreen | undefined;
  onBack?: (() => void) | undefined;
  /** Let the content use the full center measure (the promises grid) rather than
   * the narrower reading column the legal pages want. */
  wideContent?: boolean;
  children: ReactNode;
}

const RAIL: {
  id: TrustScreen;
  label: string;
  key: "onPromises" | "onPrivacy" | "onTerms" | "onShareLink";
  screen: Screen;
}[] = [
  {
    id: "promises",
    label: "Our promises",
    key: "onPromises",
    screen: "promises",
  },
  {
    id: "privacy",
    label: "Privacy",
    key: "onPrivacy",
    screen: "privacy-policy",
  },
  { id: "terms", label: "Terms", key: "onTerms", screen: "terms" },
  {
    id: "share-link",
    label: "Share your link",
    key: "onShareLink",
    screen: "share-link",
  },
];

function RailLink({
  label,
  screen,
  active,
  onNavigate,
}: {
  label: string;
  screen: Screen;
  active: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const cls = cx("trust-rail__link", active && "trust-rail__link--active");
  // A real anchor when we can navigate; the current page (or a missing handler)
  // renders as a plain, non-link label so it is not a dead link to itself.
  if (onNavigate === undefined || active) {
    return (
      <span aria-current={active ? "page" : undefined} className={cls}>
        {label}
      </span>
    );
  }
  return (
    <NavLink
      href={pathForScreen(screen)}
      onNavigate={onNavigate}
      className={cls}
    >
      {label}
    </NavLink>
  );
}

function Rail({
  current,
  onBack,
  footer,
}: {
  current?: TrustScreen | undefined;
  onBack?: (() => void) | undefined;
  footer: TrustFooterProps;
}) {
  return (
    <nav aria-label="Trust pages" className="trust-rail">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="trust-rail__back"
        >
          <Back size={16} /> Back
        </button>
      )}
      <span className="e-eyebrow trust-rail__label">Trust center</span>
      {RAIL.map((item) => (
        <RailLink
          key={item.id}
          label={item.label}
          screen={item.screen}
          active={item.id === current}
          onNavigate={footer[item.key]}
        />
      ))}
    </nav>
  );
}

export function TrustShell({
  current,
  onBack,
  wideContent = false,
  children,
  ...footer
}: TrustShellProps) {
  const wide = useMinWidth(1080);

  if (wide) {
    return (
      <div className="trust-wide">
        <div className="trust-wide__grid">
          <Rail current={current} onBack={onBack} footer={footer} />
          <div
            className={cx(
              "trust-wide__content",
              wideContent && "trust-wide__content--wide",
            )}
          >
            {children}
            <TrustFooter {...footer} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cx("trust-narrow", wideContent && "trust-narrow--wide")}>
      {onBack && (
        <div className="trust-narrow__backrow">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="trust-narrow__back"
          >
            <Back size={20} />
          </button>
        </div>
      )}
      {children}
      <TrustFooter {...footer} />
    </div>
  );
}
