import type { ReactNode } from "react";
import { Back } from "../../design/icons.tsx";
import { useMinWidth } from "../desktop/Desktop.tsx";
import { TrustFooter, type TrustFooterProps } from "./TrustFooter.tsx";

// Shared shell for the public trust pages (promises, privacy, terms, share-link).
//
// On a large screen the page is a "trust center": a sticky left rail (back + the
// four trust destinations, current one lit) beside a wide content column, the
// whole thing centered in a comfortable measure so the content is never a lonely
// strip in a sea of margin. Below the rail breakpoint it collapses to the original
// single reading column with the footer carrying cross-navigation. Pure/static.

export type TrustScreen = "promises" | "privacy" | "terms" | "share-link";

export interface TrustShellProps extends TrustFooterProps {
  current: TrustScreen;
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
}[] = [
  { id: "promises", label: "Our promises", key: "onPromises" },
  { id: "privacy", label: "Privacy", key: "onPrivacy" },
  { id: "terms", label: "Terms", key: "onTerms" },
  { id: "share-link", label: "Share your link", key: "onShareLink" },
];

function RailLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{
        appearance: "none",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        padding: "9px 12px",
        borderRadius: "var(--radius-md)",
        fontSize: 14,
        fontWeight: active ? 800 : 600,
        color: active ? "var(--text-strong)" : "var(--text-subtle)",
        background: active ? "var(--surface-tint)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}

function Rail({
  current,
  onBack,
  footer,
}: {
  current: TrustScreen;
  onBack?: (() => void) | undefined;
  footer: TrustFooterProps;
}) {
  return (
    <nav
      aria-label="Trust pages"
      style={{
        position: "sticky",
        top: 24,
        alignSelf: "start",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 12px",
            marginBottom: 6,
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-subtle)",
          }}
        >
          <Back size={16} /> Back
        </button>
      )}
      <span
        style={{
          padding: "0 12px 8px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        Trust center
      </span>
      {RAIL.map((item) => (
        <RailLink
          key={item.id}
          label={item.label}
          active={item.id === current}
          onClick={footer[item.key]}
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
      <div style={{ width: "100%", maxWidth: 1160, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "224px minmax(0, 1fr)",
            gap: 48,
            alignItems: "start",
          }}
        >
          <Rail current={current} onBack={onBack} footer={footer} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              width: "100%",
              maxWidth: wideContent ? "100%" : 780,
            }}
          >
            {children}
            <TrustFooter {...footer} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        width: "100%",
        maxWidth: wideContent ? 720 : 520,
      }}
    >
      {onBack && (
        <div style={{ alignSelf: "flex-start" }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              appearance: "none",
              border: "none",
              background: "var(--surface-card)",
              boxShadow: "var(--shadow-sm)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-body)",
            }}
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
