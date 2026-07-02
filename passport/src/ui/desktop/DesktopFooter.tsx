import { NavLink } from "../app/NavLink.tsx";
import { pathForScreen } from "../app/useAppRouter.ts";
import { TRUST_FOOTER } from "../trust/trustCopy.ts";
import { infoUrl } from "../../lib/info.ts";
import "./desktop-landing.css";

// The desktop marketing-landing footer (doc 23): logo, the trust links, the
// education library, and the medical disclaimer. Split out of DesktopLandingParts
// so that file stays under the line ceiling. The trust links are real anchors
// (NavLink): a genuine href that reads as a link, with a plain click routed
// through the SPA. The library link leaves for info.sti.care, like TrustFooter's.

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
    <footer className="dland__footer">
      <div className="dland__frame dland__footer-row">
        <img
          src="/assets/logo/logo-wordmark.svg"
          alt="sti.care"
          className="dland__footer-brand"
        />
        <nav className="dland__footer-nav">
          {onPromises && (
            <NavLink
              href={pathForScreen("promises")}
              onNavigate={onPromises}
              className="dland__footer-link"
            >
              {TRUST_FOOTER.promises}
            </NavLink>
          )}
          {onPrivacyPolicy && (
            <NavLink
              href={pathForScreen("privacy-policy")}
              onNavigate={onPrivacyPolicy}
              className="dland__footer-link"
            >
              {TRUST_FOOTER.privacy}
            </NavLink>
          )}
          {onTerms && (
            <NavLink
              href={pathForScreen("terms")}
              onNavigate={onTerms}
              className="dland__footer-link"
            >
              {TRUST_FOOTER.terms}
            </NavLink>
          )}
          {onShareLink && (
            <NavLink
              href={pathForScreen("share-link")}
              onNavigate={onShareLink}
              className="dland__footer-link"
            >
              {TRUST_FOOTER.shareLink}
            </NavLink>
          )}
          <a
            href={infoUrl("/")}
            target="_blank"
            rel="noopener noreferrer"
            className="dland__footer-link"
          >
            {TRUST_FOOTER.library}
          </a>
        </nav>
        <div className="dland__footer-note">
          General info, not medical advice. A clinic or doctor can tell you
          what’s right for you. Based on U.S. CDC guidance.
        </div>
      </div>
    </footer>
  );
}
