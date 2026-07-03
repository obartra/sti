import { useCallback, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { Shield, ShieldCheck } from "../../design/icons.tsx";
import type { VanityReportReason } from "../../api/client.ts";
import { cx } from "../../lib/cx.ts";
import "./findable.css";

// Report a findable name (doc 17, F5c). A small anonymous form: pick a reason from
// the fixed set and send. Intake is public + rate-limited; an objective rule match
// (reserved/slur) is auto-actioned server-side, the rest go to the admin review
// queue. Volume alone never removes a name, so the copy doesn't promise removal.
// The transport is injected so it's driven in tests/Storybook without a server.
// Same quiet radio-row grammar as the feedback form (doc 37): one focused task
// on the page surface, selection reading through ink and border weight.

const REASONS: { code: VanityReportReason; label: string }[] = [
  { code: "impersonation", label: "Pretending to be the service or someone" },
  { code: "abuse", label: "Abusive or harassing" },
  { code: "slur", label: "A slur or hate term" },
  { code: "spam", label: "Spam or a scam" },
  { code: "other", label: "Something else" },
];

const COPY = {
  title: "Report this name",
  legend: "Why are you reporting it?",
  anonymous: "This is anonymous. We review names that break the rules.",
  send: "Send report",
  sending: "Sending…",
  cancel: "Cancel",
  error: "Couldn't send the report. Try again.",
  doneTitle: "Thanks for the report",
  doneBody:
    "We'll review it. Names that break the rules are removed; volume alone never removes a name.",
  done: "Done",
} as const;

export interface ReportNameProps {
  /** The vanity name being reported (shown, sent in the request path). */
  name: string;
  /** Submit a report. Resolves on accept; rejects on a real failure. */
  report: (reason: VanityReportReason) => Promise<void>;
  /** Dismiss the form (cancel, or close after the thank-you). */
  onClose?: () => void;
}

export function ReportName({ name, report, onClose }: ReportNameProps) {
  const [reason, setReason] = useState<VanityReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (reason === null) return;
      setBusy(true);
      setError(null);
      void report(reason)
        .then(() => setSent(true))
        .catch(() => setError(COPY.error))
        .finally(() => setBusy(false));
    },
    [reason, report],
  );

  if (sent) return <ReportDone onClose={onClose} />;

  return (
    <div className="rn">
      <Header name={name} />
      <form onSubmit={submit} className="rn__form">
        <ReasonPicker reason={reason} onPick={setReason} disabled={busy} />
        {error !== null && <div className="rn__error">{error}</div>}
        <div className="rn__anon">{COPY.anonymous}</div>
        <div className="rn__actions">
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

function Header({ name }: { name: string }) {
  return (
    <div className="rn__head">
      <span aria-hidden className="rn__icon">
        <Shield size={18} />
      </span>
      <div>
        <div className="rn__title">{COPY.title}</div>
        <div className="rn__name">{name}</div>
      </div>
    </div>
  );
}

function ReasonPicker({
  reason,
  onPick,
  disabled,
}: {
  reason: VanityReportReason | null;
  onPick: (r: VanityReportReason) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="rn__reasons">
      <legend className="rn__legend">{COPY.legend}</legend>
      {REASONS.map(({ code, label }) => (
        <label
          key={code}
          className={cx("rn__reason", reason === code && "rn__reason--on")}
        >
          <input
            type="radio"
            name="report-reason"
            value={code}
            checked={reason === code}
            disabled={disabled}
            onChange={() => onPick(code)}
          />
          <span className="rn__reason-label">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function ReportDone({ onClose }: { onClose?: (() => void) | undefined }) {
  return (
    <div className="rn">
      <div className="rn__head">
        <span aria-hidden className="rn__icon">
          <ShieldCheck size={20} />
        </span>
        <div className="rn__done-title">{COPY.doneTitle}</div>
      </div>
      <div className="rn__done-body">{COPY.doneBody}</div>
      <Button variant="secondary" size="md" block onClick={onClose}>
        {COPY.done}
      </Button>
    </div>
  );
}
