import { Button } from "../../design/components/index.ts";
import { Key, Refresh } from "../../design/icons.tsx";
import type { ContinuityNudge } from "../app/continuityNudge.ts";
import { cx } from "../../lib/cx.ts";
import "./nudge.css";

// A low-key, dismissible reminder on Home (doc 32 continuity nudges). It appears
// only when a nudge is due, never blocks anything, and dismissing it just makes it
// rare again. It holds its own actions, so it renders as the sanctioned action
// callout (.e-card, doc 37), never a tinted card. Two kinds:
//
// - phrase: a rehearsal, "can you still find your recovery phrase?" Because the
//   phrase is the backstop, this is upkeep, not a lockout.
// - password: once a year, a gentle suggestion to refresh the password. A reminder,
//   never a forced reset.
//
// Voice: calm, plain, non-alarmist (doc 21). No exclamation, no jargon, the primary
// action names the outcome.

export interface ContinuityNudgeCardProps {
  kind: ContinuityNudge;
  /** Point the owner at Settings (where the phrase re-view and password live).
   * "phrase" opens the phrase card; "password" opens the password card. */
  onGoToSettings: () => void;
  /** Dismiss for now: records the time so it stays rare. Never affects the account. */
  onDismiss: () => void;
}

const COPY = {
  phrase: {
    title: "Can you still find your recovery phrase?",
    body: "It's how you get back in on a new device. A quick check now saves trouble later.",
    confirm: "I've got it",
    settings: "Show me where",
    dismiss: "Remind me later",
  },
  password: {
    title: "Time to refresh your password?",
    body: "It's been about a year. Changing it now is a good habit, but it's up to you.",
    confirm: "It's fine",
    settings: "Change it",
    dismiss: "Remind me later",
  },
} as const;

function NudgeIcon({ kind }: { kind: ContinuityNudge }) {
  return (
    <span aria-hidden className="nudge__icon">
      {kind === "phrase" ? <Key size={18} /> : <Refresh size={18} />}
    </span>
  );
}

export function ContinuityNudgeCard({
  kind,
  onGoToSettings,
  onDismiss,
}: ContinuityNudgeCardProps) {
  const c = COPY[kind];
  // "confirm" and "remind me later" are both plain dismissals: the owner is telling
  // us they are fine, or to ask again later. Neither touches the account; both just
  // record the time so the prompt stays rare.
  return (
    <div className={cx("e-card", "nudge")}>
      <div className="nudge__head">
        <NudgeIcon kind={kind} />
        <div className="nudge__body">
          <div className="nudge__title">{c.title}</div>
          <div className="nudge__text">{c.body}</div>
        </div>
      </div>
      <div className="nudge__actions">
        <Button variant="primary" size="sm" onClick={onDismiss}>
          {c.confirm}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onGoToSettings();
            onDismiss();
          }}
        >
          {c.settings}
        </Button>
        <Button variant="quiet" size="sm" onClick={onDismiss}>
          {c.dismiss}
        </Button>
      </div>
    </div>
  );
}
