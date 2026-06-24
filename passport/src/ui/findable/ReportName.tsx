import { useCallback, useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Shield, ShieldCheck } from "../../design/icons.tsx";
import type { VanityReportReason } from "../../api/client.ts";

// Report a findable name (doc 17, F5c). A small anonymous form: pick a reason from
// the fixed set and send. Intake is public + rate-limited; an objective rule match
// (reserved/slur) is auto-actioned server-side, the rest go to the admin review
// queue. Volume alone never removes a name, so the copy doesn't promise removal.
// The transport is injected so it's driven in tests/Storybook without a server.

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
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Header name={name} />
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <ReasonPicker reason={reason} onPick={setReason} disabled={busy} />
        {error !== null && (
          <div style={{ fontSize: 12.5, color: "var(--status-expired-fg)" }}>
            {error}
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-subtle)",
            lineHeight: 1.45,
          }}
        >
          {COPY.anonymous}
        </div>
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

function Header({ name }: { name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--text-accent)", flex: "none" }}>
        <Shield size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 15, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-body)",
            wordBreak: "break-all",
          }}
        >
          {name}
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
  reason: VanityReportReason | null;
  onPick: (r: VanityReportReason) => void;
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
            name="report-reason"
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

function ReportDone({ onClose }: { onClose?: (() => void) | undefined }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <ShieldCheck size={20} />
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
