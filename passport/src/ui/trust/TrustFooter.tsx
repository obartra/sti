import type { CSSProperties } from "react";
import { NavLink } from "../app/NavLink.tsx";
import { pathForScreen } from "../app/useAppRouter.ts";
import { TRUST_FOOTER } from "./trustCopy.ts";

// The quiet trust footer shown on the public surfaces (doc 23): the landing, the
// trust pages themselves, and the marketing site. Not worn by the logged-in app,
// which surfaces the same links from Privacy settings instead. Each destination is a
// real anchor (NavLink): it has a genuine href and reads as a link, but a plain click
// routes through the SPA. (Accessible, and "real links, not /#fragments".)

const linkStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--text-accent)",
  textDecoration: "none",
  cursor: "pointer",
};

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
    <footer
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
        paddingTop: 18,
        borderTop: "1px solid var(--divider)",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {onPromises && (
          <NavLink
            href={pathForScreen("promises")}
            onNavigate={onPromises}
            style={linkStyle}
          >
            {TRUST_FOOTER.promises}
          </NavLink>
        )}
        {onPrivacy && (
          <NavLink
            href={pathForScreen("privacy-policy")}
            onNavigate={onPrivacy}
            style={linkStyle}
          >
            {TRUST_FOOTER.privacy}
          </NavLink>
        )}
        {onTerms && (
          <NavLink
            href={pathForScreen("terms")}
            onNavigate={onTerms}
            style={linkStyle}
          >
            {TRUST_FOOTER.terms}
          </NavLink>
        )}
        {onShareLink && (
          <NavLink
            href={pathForScreen("share-link")}
            onNavigate={onShareLink}
            style={linkStyle}
          >
            {TRUST_FOOTER.shareLink}
          </NavLink>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
        {TRUST_FOOTER.tagline}
      </div>
      {onFeedback && (
        <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
          {TRUST_FOOTER.feedbackLead}{" "}
          <NavLink
            href={pathForScreen("feedback")}
            onNavigate={onFeedback}
            style={{
              color: "var(--text-accent)",
              fontWeight: 700,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {TRUST_FOOTER.feedbackLink}
          </NavLink>
        </div>
      )}
    </footer>
  );
}
