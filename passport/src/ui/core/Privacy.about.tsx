import type { CSSProperties } from "react";
import { COPY, keepUntilLabel, fieldLbl } from "./Privacy.parts.tsx";

export interface AboutFooterProps {
  now: number;
  onViewPromises?: (() => void) | undefined;
  onViewPrivacyPolicy?: (() => void) | undefined;
  onViewTerms?: (() => void) | undefined;
}

const aboutLink: CSSProperties = {
  alignSelf: "flex-start",
  padding: 0,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
};

// A de-emphasized footer group at the very bottom of Settings: the trust pages
// (promises, privacy, terms) plus the plain retention note. Kept reachable but
// clearly set apart from the account and profile controls above.
export function AboutFooter({
  now,
  onViewPromises,
  onViewPrivacyPolicy,
  onViewTerms,
}: AboutFooterProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginTop: 8,
        paddingTop: 16,
        borderTop: "1px solid var(--divider)",
      }}
    >
      <div style={{ ...fieldLbl, marginBottom: 0 }}>{COPY.aboutTitle}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {onViewPromises && (
          <button type="button" onClick={onViewPromises} style={aboutLink}>
            {COPY.aboutPromises}
          </button>
        )}
        {onViewPrivacyPolicy && (
          <button type="button" onClick={onViewPrivacyPolicy} style={aboutLink}>
            {COPY.aboutPrivacy}
          </button>
        )}
        {onViewTerms && (
          <button type="button" onClick={onViewTerms} style={aboutLink}>
            {COPY.aboutTerms}
          </button>
        )}
      </div>
      <RetentionNote now={now} />
    </div>
  );
}

// A calm transparency note (not an alarm): the server deletes an abandoned backup
// after the inactivity window (server STI_ACCOUNT_INACTIVITY_TTL), and using the app
// resets it. Since opening the app IS the reset, this is honest disclosure rather
// than an actionable countdown; the date is the reference instant plus the window.
function RetentionNote({ now }: { now: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "2px 2px 0",
      }}
    >
      <div style={fieldLbl}>{COPY.keepTitle}</div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text-muted)",
        }}
      >
        {COPY.keepBody}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        {COPY.keepPrefix}
        <strong style={{ color: "var(--text-strong)", fontWeight: 700 }}>
          {keepUntilLabel(now)}
        </strong>
        .
      </p>
    </div>
  );
}
