import type { CSSProperties } from "react";

// The consent line at the point of account creation (doc 22). Links the terms and
// privacy policy inline; renders nothing if neither is wired.

const consentLink: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
  fontWeight: 700,
  color: "var(--text-accent)",
};

export function ConsentLine({
  onViewPrivacyPolicy,
  onViewTerms,
}: {
  onViewPrivacyPolicy?: (() => void) | undefined;
  onViewTerms?: (() => void) | undefined;
}) {
  if (!onViewPrivacyPolicy && !onViewTerms) return null;
  return (
    <p
      style={{
        margin: 0,
        textAlign: "center",
        fontSize: 12,
        color: "var(--text-subtle)",
      }}
    >
      By entering, you agree to our{" "}
      <button type="button" style={consentLink} onClick={onViewTerms}>
        Terms
      </button>{" "}
      and{" "}
      <button type="button" style={consentLink} onClick={onViewPrivacyPolicy}>
        Privacy
      </button>
      .
    </p>
  );
}
