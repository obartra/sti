import { Button } from "../../design/components/index.ts";
import { Info, Check, ArrowRight } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { COPY, ASK } from "./recovery.copy.ts";

// The verify step: tap the asked word among the fixed option set to prove the
// phrase is saved.
// One tappable word option in the verify step.
function OptionButton({
  word,
  active,
  correct,
  onPick,
}: {
  word: string;
  active: boolean;
  correct: boolean;
  onPick: (word: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(word)}
      style={{
        appearance: "none",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        border:
          "2px solid " +
          (active
            ? correct
              ? "var(--accent)"
              : "var(--status-expired-base)"
            : "var(--border-card)"),
        background: active
          ? correct
            ? "var(--accent-soft)"
            : "var(--expired-50, #FBE7E4)"
          : "var(--surface-card)",
        color: "var(--text-strong)",
        fontSize: 16,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{word}</span>
      {active &&
        (correct ? (
          <span style={{ color: "var(--text-accent)" }}>
            <Check size={18} />
          </span>
        ) : (
          <span style={{ color: "var(--status-expired-base)" }}>
            <Info size={18} />
          </span>
        ))}
    </button>
  );
}

// The wrong/right feedback line under the option list.
function ConfirmFeedback({
  picked,
  correct,
}: {
  picked: string | null;
  correct: boolean;
}) {
  return (
    <>
      {picked !== null && !correct && (
        <div
          style={{
            fontSize: 13,
            color: "var(--status-expired-fg)",
            display: "flex",
            gap: 7,
            lineHeight: 1.5,
          }}
        >
          <span style={{ flex: "none", marginTop: 1 }}>
            <Info size={14} />
          </span>{" "}
          {COPY.confirmWrong}
        </div>
      )}
      {correct && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-accent)",
            display: "flex",
            gap: 7,
            lineHeight: 1.5,
          }}
        >
          <span style={{ flex: "none", marginTop: 1 }}>
            <Check size={14} />
          </span>{" "}
          {COPY.confirmRight}
        </div>
      )}
    </>
  );
}

export function ConfirmPhase({
  options,
  picked,
  correct,
  onPick,
  onBack,
  onReshow,
  onContinue,
}: {
  options: readonly string[];
  picked: string | null;
  correct: boolean;
  onPick: (word: string) => void;
  onBack?: (() => void) | undefined;
  onReshow: () => void;
  onContinue?: (() => void) | undefined;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
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
          {COPY.confirmTitle}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-body)", marginTop: 6 }}>
          {COPY.confirmSub.replace("{n}", String(ASK + 1))}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((w) => (
          <OptionButton
            key={w}
            word={w}
            active={picked === w}
            correct={correct}
            onPick={onPick}
          />
        ))}
      </div>
      <ConfirmFeedback picked={picked} correct={correct} />
      <Button variant="ghost" size="md" block onClick={onReshow}>
        {COPY.reshow}
      </Button>
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!correct}
        onClick={onContinue}
      >
        {COPY.cta} <ArrowRight size={18} />
      </Button>
    </div>
  );
}
