import { COPY, keepUntilLabel } from "./Privacy.parts.tsx";
import "./settings.css";

export interface AboutFooterProps {
  now: number;
  onViewPromises?: (() => void) | undefined;
  onViewPrivacyPolicy?: (() => void) | undefined;
  onViewTerms?: (() => void) | undefined;
}

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
    <div className="st__about">
      <div className="st__section-label">{COPY.aboutTitle}</div>
      <div className="st__about-links">
        {onViewPromises && (
          <button
            type="button"
            onClick={onViewPromises}
            className="st__about-link"
          >
            {COPY.aboutPromises}
          </button>
        )}
        {onViewPrivacyPolicy && (
          <button
            type="button"
            onClick={onViewPrivacyPolicy}
            className="st__about-link"
          >
            {COPY.aboutPrivacy}
          </button>
        )}
        {onViewTerms && (
          <button
            type="button"
            onClick={onViewTerms}
            className="st__about-link"
          >
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
    <div className="st__keep">
      <div className="st__keep-title">{COPY.keepTitle}</div>
      <p className="st__keep-body">{COPY.keepBody}</p>
      <p className="st__keep-body">
        {COPY.keepPrefix}
        <strong className="st__keep-date">{keepUntilLabel(now)}</strong>.
      </p>
    </div>
  );
}
