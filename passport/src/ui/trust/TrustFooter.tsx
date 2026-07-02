import { NavLink } from "../app/NavLink.tsx";
import { pathForScreen } from "../app/useAppRouter.ts";
import { infoUrl } from "../../lib/info.ts";
import { TRUST_FOOTER } from "./trustCopy.ts";
import "./trust-footer.css";

// The quiet trust footer shown on the public surfaces (doc 23): the landing, the
// trust pages themselves, and the marketing site. Not worn by the logged-in app,
// which surfaces the same links from Privacy settings instead. Each destination is a
// real anchor (NavLink): it has a genuine href and reads as a link, but a plain click
// routes through the SPA. (Accessible, and "real links, not /#fragments".)

export interface TrustFooterProps {
  onPromises?: (() => void) | undefined;
  onPrivacy?: (() => void) | undefined;
  onTerms?: (() => void) | undefined;
  /** Open the public "share your link" guide (docs 16, 17). */
  onShareLink?: (() => void) | undefined;
  /** Open the "Something wrong?" report form (doc 35). */
  onFeedback?: (() => void) | undefined;
}

export function TrustFooter({
  onPromises,
  onPrivacy,
  onTerms,
  onShareLink,
  onFeedback,
}: TrustFooterProps) {
  return (
    <footer className="trust-footer">
      <div className="trust-footer__links">
        {onPromises && (
          <NavLink
            href={pathForScreen("promises")}
            onNavigate={onPromises}
            className="trust-footer__link"
          >
            {TRUST_FOOTER.promises}
          </NavLink>
        )}
        {onPrivacy && (
          <NavLink
            href={pathForScreen("privacy-policy")}
            onNavigate={onPrivacy}
            className="trust-footer__link"
          >
            {TRUST_FOOTER.privacy}
          </NavLink>
        )}
        {onTerms && (
          <NavLink
            href={pathForScreen("terms")}
            onNavigate={onTerms}
            className="trust-footer__link"
          >
            {TRUST_FOOTER.terms}
          </NavLink>
        )}
        {onShareLink && (
          <NavLink
            href={pathForScreen("share-link")}
            onNavigate={onShareLink}
            className="trust-footer__link"
          >
            {TRUST_FOOTER.shareLink}
          </NavLink>
        )}
        {/* The education library lives on its own site (doc 34), so this is a real
            external anchor, not an in-app route. noreferrer keeps the app origin off
            the outbound request. */}
        <a
          href={infoUrl("/")}
          target="_blank"
          rel="noopener noreferrer"
          className="trust-footer__link"
        >
          {TRUST_FOOTER.library}
        </a>
      </div>
      <div className="trust-footer__meta">{TRUST_FOOTER.tagline}</div>
      {onFeedback && (
        <div className="trust-footer__meta">
          {TRUST_FOOTER.feedbackLead}{" "}
          <NavLink
            href={pathForScreen("feedback")}
            onNavigate={onFeedback}
            className="trust-footer__link"
          >
            {TRUST_FOOTER.feedbackLink}
          </NavLink>
        </div>
      )}
    </footer>
  );
}
