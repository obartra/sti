import { useCallback, useState } from "react";
import { Button, Card, Field } from "../../design/components/index.ts";
import { Help, Check } from "../../design/icons.tsx";
import { type FeedbackReason, FEEDBACK_BODY_MAX } from "../../api/client.ts";

// The "Something wrong?" form (doc 35). It replaced a mailto so a report lands in
// the operator queue instead of an inbox. A person picks a fixed category and can add
// an optional note; the note is the one free-text field the server stores, so the copy
// asks them to leave out anything they would not want kept, and it never promises a
// reply (we collect no way to reach them). The transport is injected so it drives in
// tests and Storybook without a server. Copy follows doc 21: plain, calm, honest.

const REASONS: { code: FeedbackReason; label: string }[] = [
  { code: "broken", label: "Something's broken" },
  { code: "confusing", label: "Something's confusing" },
  { code: "safety", label: "A safety concern" },
  { code: "other", label: "Something else" },
];

const COPY = {
  title: "Something wrong?",
  lead: "Tell us what happened and we'll look into it.",
  legend: "What kind of thing?",
  noteLabel: "Anything that helps (optional)",
  notePlaceholder: "What happened?",
  privacy:
    "This is the one thing we keep, so we can read it and help. Please leave out anything sensitive, like your name.",
  send: "Send",
  sending: "Sending…",
  cancel: "Cancel",
  error: "Couldn't send that. Try again.",
  doneTitle: "Thanks",
  doneBody: "We read every one and we'll look into it. We can't reply here.",
  done: "Done",
} as const;

export interface FeedbackProps {
  /** File a report. Resolves on accept; rejects on a real failure. */
  submit: (reason: FeedbackReason, body: string) => Promise<void>;
  /** Dismiss the form (cancel, or close after the thank-you). */
  onClose?: () => void;
}

export function Feedback({ submit, onClose }: FeedbackProps) {
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (reason === null) return;
      setBusy(true);
      setError(null);
      void submit(reason, body.trim())
        .then(() => setSent(true))
        .catch(() => setError(COPY.error))
        .finally(() => setBusy(false));
    },
    [reason, body, submit],
  );

  if (sent) return <FeedbackDone onClose={onClose} />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Header />
      <form
        onSubmit={send}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <ReasonPicker reason={reason} onPick={setReason} disabled={busy} />
        <Field
          label={COPY.noteLabel}
          htmlFor="feedback-note"
          hint={COPY.privacy}
        >
          <textarea
            id="feedback-note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
            maxLength={FEEDBACK_BODY_MAX}
            rows={3}
            placeholder={COPY.notePlaceholder}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              minHeight: 72,
              padding: "9px 11px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-card)",
              background: "var(--surface-input, transparent)",
              color: "var(--text-body)",
              font: "inherit",
              fontSize: 13.5,
              lineHeight: 1.45,
            }}
          />
        </Field>
        {error !== null && (
          <div style={{ fontSize: 12.5, color: "var(--status-expired-fg)" }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="submit"
            variant="primary"
            size="md"
            block
            disabled={busy || reason === null}
          >
            {busy ? COPY.sending : COPY.send}
          </Button>
          {onClose && (
            <Button variant="ghost" size="md" disabled={busy} onClick={onClose}>
              {COPY.cancel}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--text-accent)", flex: "none" }}>
        <Help size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 15, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
        <div
          style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.45 }}
        >
          {COPY.lead}
        </div>
      </div>
    </div>
  );
}

function ReasonPicker({
  reason,
  onPick,
  disabled,
}: {
  reason: FeedbackReason | null;
  onPick: (r: FeedbackReason) => void;
  disabled: boolean;
}) {
  return (
    <fieldset
      style={{
        border: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <legend
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: "var(--text-strong)",
          padding: 0,
          marginBottom: 2,
        }}
      >
        {COPY.legend}
      </legend>
      {REASONS.map(({ code, label }) => (
        <label
          key={code}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 11px",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            border:
              reason === code
                ? "1.5px solid var(--text-accent)"
                : "1px solid var(--border-card)",
            background: reason === code ? "var(--accent-soft)" : "transparent",
          }}
        >
          <input
            type="radio"
            name="feedback-reason"
            value={code}
            checked={reason === code}
            disabled={disabled}
            onChange={() => onPick(code)}
          />
          <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function FeedbackDone({ onClose }: { onClose?: (() => void) | undefined }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <Check size={20} />
        </span>
        <div
          style={{ fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {COPY.doneTitle}
        </div>
      </div>
      <div
        style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        {COPY.doneBody}
      </div>
      <Button variant="secondary" size="md" block onClick={onClose}>
        {COPY.done}
      </Button>
    </Card>
  );
}
