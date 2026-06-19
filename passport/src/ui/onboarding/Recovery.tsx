import { useState } from "react";
import { COPY, ASK } from "./recovery.copy.ts";
import { ConfirmPhase } from "./recoveryPhases.tsx";
import { ShowPhase } from "./recoveryShow.tsx";

// B2 recovery phrase. Faithful port of onboarding.jsx Recovery, copy verbatim
// from copy.js (recovery). Passkey stays the primary unlock; this phrase is the
// only no-PII way back in if the device is lost. No email/phone, no server reset.

export interface RecoveryProps {
  onBack?: (() => void) | undefined;
  onContinue?: (() => void) | undefined;
}

export function Recovery({ onBack, onContinue }: RecoveryProps) {
  const words = COPY.words;
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<"show" | "confirm">("show");
  const [picked, setPicked] = useState<string | null>(null);
  const askWord = words[ASK];
  const correct = picked !== null && picked === askWord;
  // Fixed, deterministic option set: the correct word among three decoys.
  const options = [words[3], words[ASK], words[10], words[1]];
  const copyPhrase = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (phase === "confirm") {
    return (
      <ConfirmPhase
        options={options}
        picked={picked}
        correct={correct}
        onPick={setPicked}
        onBack={onBack}
        onReshow={() => {
          setPhase("show");
          setPicked(null);
        }}
        onContinue={onContinue}
      />
    );
  }

  return (
    <ShowPhase
      words={words}
      revealed={revealed}
      copied={copied}
      onReveal={() => setRevealed(true)}
      onHide={() => setRevealed(false)}
      onCopy={copyPhrase}
      onBack={onBack}
      onSaved={() => setPhase("confirm")}
    />
  );
}
