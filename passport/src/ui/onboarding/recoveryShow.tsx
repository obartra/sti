import { Button } from "../../design/components/index.ts";
import { Eye, Copy, EyeOff, ArrowRight } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { COPY } from "./recovery.copy.ts";
import { cx } from "../../lib/cx.ts";
import "./onboarding.css";

// The recovery token plus its tap-to-reveal cover. The phrase is a single
// app-generated high-entropy token (not a word list), presented as the document
// it is: a hairline-bordered paper block in monospace, so it reads as a thing to
// keep and copies cleanly.
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
    <div className="onb__doc-wrap">
      <div className={cx("onb__doc", !revealed && "onb__doc--covered")}>
        {phrase}
      </div>
      {!revealed && (
        <button type="button" onClick={onReveal} className="onb__doc-cover">
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
      <div className="e-eyebrow onb__doc-label">{COPY.phraseLabel}</div>
      <PhraseToken phrase={phrase} revealed={revealed} onReveal={onReveal} />
      {revealed && (
        <div className="onb__doc-actions">
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
    <div className="onb">
      <TopBack title={COPY.step} onBack={onBack} />
      <div>
        <h1 className="onb__title">{COPY.title}</h1>
        <p className="onb__sub">{COPY.sub}</p>
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
