import { useState } from "react";
import { ShowPhase } from "./recoveryShow.tsx";

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

// The synchronous fallback for contexts where navigator.clipboard is absent or
// blocked (older Safari, some in-app webviews): a hidden textarea + execCommand.
function execCommandCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // execCommand is deprecated but remains the only sync copy fallback, and runs
    // exactly where the async Clipboard API isn't available, so keep it.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Copy text to the clipboard via the async API, falling back to execCommandCopy.
// Returns whether a copy path succeeded.
function copyToClipboard(text: string): boolean {
  try {
    // Typed present by the DOM lib but actually absent in some webviews, so treat
    // it as optional and fall through when it isn't there.
    const clip: Clipboard | undefined =
      typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (clip) {
      void clip.writeText(text).catch(() => undefined);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  return execCommandCopy(text);
}

export function Recovery({ phrase, onBack, onContinue }: RecoveryProps) {
  const [revealed, setRevealed] = useState(false);
  // Sticky: once revealed, the owner can continue even after hiding again. Hiding
  // is just a visual cover, not a re-lock of the "I've saved it" confirm.
  const [everRevealed, setEverRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPhrase = () => {
    if (!copyToClipboard(phrase)) return;
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
