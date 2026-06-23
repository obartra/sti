import { useState } from "react";
import { ShowPhase } from "./recoveryShow.tsx";
import { copyText } from "../../lib/clipboard.ts";

// B2 recovery phrase. The phrase is the app-generated, high-entropy recovery
// token (the only no-PII way back in if the device is lost; no email/phone, no
// server reset). It is shown once here, behind a tap-to-reveal, with copy. The
// owner confirms they have saved it ("I've saved it") to continue; there is no
// word-by-word check because the token is a single opaque string.

export interface RecoveryProps {
  /** The real recovery token to show once (from the just-created account). */
  phrase: string;
  onBack?: (() => void) | undefined;
  onContinue?: (() => void) | undefined;
}

export function Recovery({ phrase, onBack, onContinue }: RecoveryProps) {
  const [revealed, setRevealed] = useState(false);
  // Sticky: once revealed, the owner can continue even after hiding again. Hiding
  // is just a visual cover, not a re-lock of the "I've saved it" confirm.
  const [everRevealed, setEverRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPhrase = () => {
    if (!copyText(phrase)) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <ShowPhase
      phrase={phrase}
      revealed={revealed}
      canSave={everRevealed}
      copied={copied}
      onReveal={() => {
        setRevealed(true);
        setEverRevealed(true);
      }}
      onHide={() => setRevealed(false)}
      onCopy={copyPhrase}
      onBack={onBack}
      onSaved={() => onContinue?.()}
    />
  );
}
