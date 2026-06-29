import type { CSSProperties } from "react";
import { NavLink } from "../app/NavLink.tsx";
import { pathForScreen } from "../app/useAppRouter.ts";
import { TRUST_FOOTER } from "../trust/trustCopy.ts";

// The desktop marketing-landing footer (doc 23): logo, the trust links, and the
// medical disclaimer. Split out of DesktopLandingParts so that file stays under
// the line ceiling. The trust links are real anchors (NavLink): a genuine href that
// reads as a link, with a plain click routed through the SPA.

const SECTION_MAX: CSSProperties = { maxWidth: 1120, margin: "0 auto" };

const footerLink: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--text-accent)",
  textDecoration: "none",
  cursor: "pointer",
};

export interface FooterLinks {
  onPromises?: (() => void) | undefined;
  onPrivacyPolicy?: (() => void) | undefined;
  onTerms?: (() => void) | undefined;
  onShareLink?: (() => void) | undefined;
}

export function LandingFooter({
  onPromises,
  onPrivacyPolicy,
  onTerms,
  onShareLink,
}: FooterLinks) {
  return (
    <footer style={{ borderTop: "1px solid var(--divider)" }}>
      <div
        style={{
          ...SECTION_MAX,
          padding: "32px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <img
          src="/assets/logo/logo-wordmark.svg"
          alt="sti.care"
          style={{ height: 26, opacity: 0.9 }}
        />
        <nav style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {onPromises && (
            <NavLink
              href={pathForScreen("promises")}
              onNavigate={onPromises}
              style={footerLink}
            >
              {TRUST_FOOTER.promises}
            </NavLink>
          )}
          {onPrivacyPolicy && (
            <NavLink
              href={pathForScreen("privacy-policy")}
              onNavigate={onPrivacyPolicy}
              style={footerLink}
            >
              {TRUST_FOOTER.privacy}
            </NavLink>
          )}
          {onTerms && (
            <NavLink
              href={pathForScreen("terms")}
              onNavigate={onTerms}
              style={footerLink}
            >
              {TRUST_FOOTER.terms}
            </NavLink>
          )}
          {onShareLink && (
            <NavLink
              href={pathForScreen("share-link")}
              onNavigate={onShareLink}
              style={footerLink}
            >
              {TRUST_FOOTER.shareLink}
            </NavLink>
          )}
        </nav>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-subtle)",
            lineHeight: 1.5,
            maxWidth: 460,
          }}
        >
          General info, not medical advice. A clinic or doctor can tell you
          what’s right for you. Based on U.S. CDC guidance.
        </div>
      </div>
    </footer>
  );
}
