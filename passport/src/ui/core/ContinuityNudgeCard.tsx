import { Button, Card } from "../../design/components/index.ts";
import { Key, Refresh } from "../../design/icons.tsx";
import type { ContinuityNudge } from "../app/continuityNudge.ts";

// A low-key, dismissible reminder on Home (doc 32 continuity nudges). It appears
// only when a nudge is due, never blocks anything, and dismissing it just makes it
// rare again. Two kinds:
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
    <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
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
    <Card
      variant="tint"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        <NudgeIcon kind={kind} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {c.title}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-body)",
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            {c.body}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
    </Card>
  );
}
