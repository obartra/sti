import "./onboarding.css";

// The consent line at the point of account creation (doc 23). Links the terms and
// privacy policy inline; renders nothing if neither is wired.
export function ConsentLine({
  onViewPrivacyPolicy,
  onViewTerms,
}: {
  onViewPrivacyPolicy?: (() => void) | undefined;
  onViewTerms?: (() => void) | undefined;
}) {
  if (!onViewPrivacyPolicy && !onViewTerms) return null;
  return (
    <p className="onb__consent">
      By entering, you agree to our{" "}
      <button type="button" className="onb__link" onClick={onViewTerms}>
        Terms
      </button>{" "}
      and{" "}
      <button type="button" className="onb__link" onClick={onViewPrivacyPolicy}>
        Privacy
      </button>
      .
    </p>
  );
}
