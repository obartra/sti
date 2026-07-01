import { Button } from "../../design/components/index.ts";
import { Eye, Copy, EyeOff, ArrowRight } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { COPY } from "./recovery.copy.ts";

// The recovery token plus its tap-to-reveal cover. The phrase is a single
// app-generated high-entropy token (not a word list), shown in a monospace
// block so it copies cleanly.
function PhraseToken({
  phrase,
  revealed,
  onReveal,
}: {
  phrase: string;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
          minHeight: 72,
          boxShadow: "var(--shadow-sm)",
          filter: revealed ? "none" : "blur(6px)",
          userSelect: revealed ? "auto" : "none",
          transition: "filter var(--dur-base) var(--ease-gentle)",
          fontFamily: "var(--font-mono)",
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.7,
          letterSpacing: "0.02em",
          color: "var(--text-strong)",
          wordBreak: "break-all",
        }}
      >
        {phrase}
      </div>
      {!revealed && (
        <button
          type="button"
          onClick={onReveal}
          style={{
            position: "absolute",
            inset: 0,
            appearance: "none",
            border: "none",
            cursor: "pointer",
            background: "transparent",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "var(--text-accent)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <Eye size={22} /> {COPY.revealHint}
        </button>
      )}
    </div>
  );
}

// The labeled recovery token plus the copy/hide controls shown once revealed.
function PhraseSection({
  phrase,
  revealed,
  copied,
  onReveal,
  onHide,
  onCopy,
}: {
  phrase: string;
  revealed: boolean;
  copied: boolean;
  onReveal: () => void;
  onHide: () => void;
  onCopy: () => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          marginBottom: 8,
        }}
      >
        {COPY.phraseLabel}
      </div>
      <PhraseToken phrase={phrase} revealed={revealed} onReveal={onReveal} />
      {revealed && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy size={15} />}
            onClick={onCopy}
          >
            {copied ? COPY.copied : COPY.copy}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<EyeOff size={15} />}
            onClick={onHide}
          >
            Hide
          </Button>
        </div>
      )}
    </div>
  );
}

// The phrase view: the title, one short line, the reveal block with copy/hide
// controls, and the "I've saved it" confirm.
export function ShowPhase({
  phrase,
  revealed,
  canSave,
  copied,
  onReveal,
  onHide,
  onCopy,
  onBack,
  onSaved,
}: {
  phrase: string;
  revealed: boolean;
  /** Revealed at least once, so the owner may continue even if now hidden. */
  canSave: boolean;
  copied: boolean;
  onReveal: () => void;
  onHide: () => void;
  onCopy: () => void;
  onBack?: (() => void) | undefined;
  onSaved: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <TopBack title={COPY.step} onBack={onBack} />
      <div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.title}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-body)", marginTop: 6 }}>
          {COPY.sub}
        </p>
      </div>

      <PhraseSection
        phrase={phrase}
        revealed={revealed}
        copied={copied}
        onReveal={onReveal}
        onHide={onHide}
        onCopy={onCopy}
      />

      <Button
        variant="primary"
        size="lg"
        block
        disabled={!canSave}
        onClick={onSaved}
      >
        {COPY.savedCta} <ArrowRight size={18} />
      </Button>
    </div>
  );
}
