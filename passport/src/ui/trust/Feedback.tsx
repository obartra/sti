import { useCallback, useState } from "react";
import { Button, Field } from "../../design/components/index.ts";
import { Help, Check } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import { type FeedbackReason, FEEDBACK_BODY_MAX } from "../../api/client.ts";
import "./feedback.css";

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
    <div className="fb">
      <Header />
      <form onSubmit={send} className="fb__form">
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
            className="fb__note"
          />
        </Field>
        {error !== null && <div className="fb__error">{error}</div>}
        <div className="fb__actions">
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
    </div>
  );
}

function Header() {
  return (
    <div className="fb__head">
      <span className="fb__head-icon">
        <Help size={18} />
      </span>
      <div className="fb__head-body">
        <div className="fb__title">{COPY.title}</div>
        <div className="fb__lead">{COPY.lead}</div>
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
    <fieldset className="fb__reasons">
      <legend className="fb__legend">{COPY.legend}</legend>
      {REASONS.map(({ code, label }) => (
        <label
          key={code}
          className={cx("fb__reason", reason === code && "fb__reason--on")}
        >
          <input
            type="radio"
            name="feedback-reason"
            value={code}
            checked={reason === code}
            disabled={disabled}
            onChange={() => onPick(code)}
          />
          <span className="fb__reason-label">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function FeedbackDone({ onClose }: { onClose?: (() => void) | undefined }) {
  return (
    <div className="fb">
      <div className="fb__head">
        <span className="fb__head-icon">
          <Check size={20} />
        </span>
        <div className="fb__done-title">{COPY.doneTitle}</div>
      </div>
      <div className="fb__done-body">{COPY.doneBody}</div>
      <Button variant="secondary" size="md" block onClick={onClose}>
        {COPY.done}
      </Button>
    </div>
  );
}
