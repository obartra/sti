import type { CSSProperties } from "react";
import { TRUST_FOOTER } from "./trustCopy.ts";

// The quiet trust footer shown on the public surfaces (doc 22): the landing, the
// trust pages themselves, and the marketing site. Not worn by the logged-in app,
// which surfaces the same links from Privacy settings instead.

const linkBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--text-accent)",
};

export interface TrustFooterProps {
  onPromises?: (() => void) | undefined;
  onPrivacy?: (() => void) | undefined;
  onTerms?: (() => void) | undefined;
}

export function TrustFooter({
  onPromises,
  onPrivacy,
  onTerms,
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
        <button type="button" style={linkBtn} onClick={onPromises}>
          {TRUST_FOOTER.promises}
        </button>
        <button type="button" style={linkBtn} onClick={onPrivacy}>
          {TRUST_FOOTER.privacy}
        </button>
        <button type="button" style={linkBtn} onClick={onTerms}>
          {TRUST_FOOTER.terms}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
        {TRUST_FOOTER.tagline}
      </div>
    </footer>
  );
}
