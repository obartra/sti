import {
  LandingHeader,
  Hero,
  ValueBand,
  ClosingCTA,
} from "./DesktopLandingParts.tsx";
import { LandingFooter } from "./DesktopFooter.tsx";

/* A1 desktop marketing landing. Faithful port of the design's app/desktop.jsx
   Landing: same content, composed from the section components in
   DesktopLandingParts.tsx so each file stays under the length ceiling. */

export interface DesktopLandingProps {
  onClaim?: () => void;
  onSample?: () => void;
  onLogin?: () => void;
  onHome?: () => void;
  onPromises?: () => void;
  onPrivacyPolicy?: () => void;
  onTerms?: () => void;
}

export function DesktopLanding({
  onClaim,
  onSample,
  onLogin,
  onHome,
  onPromises,
  onPrivacyPolicy,
  onTerms,
}: DesktopLandingProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        background: "var(--surface-app)",
        color: "var(--text-body)",
      }}
    >
      <LandingHeader onClaim={onClaim} onLogin={onLogin} onHome={onHome} />
      <Hero onClaim={onClaim} onSample={onSample} />
      <ValueBand />
      <ClosingCTA onClaim={onClaim} />
      <LandingFooter
        onPromises={onPromises}
        onPrivacyPolicy={onPrivacyPolicy}
        onTerms={onTerms}
      />
    </div>
  );
}
