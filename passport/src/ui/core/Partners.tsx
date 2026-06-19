import { Button } from "../../design/components/index.ts";
import { Bell } from "../../design/icons.tsx";
import {
  COPY,
  DEFAULT_SINCE,
  DEFAULT_EARLIER,
  usePartnersState,
} from "./Partners.parts.tsx";
import type { Recipient } from "./Partners.parts.tsx";
import {
  IntroCards,
  MessagePreview,
  AnonCheck,
  BatchCard,
} from "./Partners.review.tsx";
import { RecipientsSection } from "./Partners.recipients.tsx";
import { usePartnersSentState, DraftView } from "./Partners.sent.tsx";
import { LockedView } from "./Partners.locked.tsx";

export type { Recipient };

export interface PartnersProps {
  /** Recent linkups since the last clear test (defaults to the seeded list). */
  recipients?: Recipient[];
  /** Linkups before the last clear test (defaults to the seeded list). */
  earlier?: Recipient[];
  /** Navigate to the alert preview. */
  onPreviewAlert?: (() => void) | undefined;
  /** Commit the report, advancing to the draft window. */
  onSend?: (() => void) | undefined;
  /** Dismiss the flow ("Not now"). */
  onDecline?: (() => void) | undefined;
}

export function Partners({
  recipients: initialRecipients = DEFAULT_SINCE,
  earlier: initialEarlier = DEFAULT_EARLIER,
  onPreviewAlert,
  onSend,
  onDecline,
}: PartnersProps) {
  const state = usePartnersState(initialRecipients, initialEarlier);
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
      <h1
        style={{
          fontSize: 23,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
          lineHeight: 1.2,
        }}
      >
        {COPY.title}
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--text-body)",
          margin: 0,
        }}
      >
        {COPY.sub}
      </p>
      <IntroCards />
      <RecipientsSection state={state} />
      <MessagePreview onPreviewAlert={onPreviewAlert} />
      <AnonCheck safe={state.safe} />
      <BatchCard />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!state.canSend}
          icon={<Bell size={18} />}
          onClick={onSend}
        >
          {COPY.send}
        </Button>
        <Button variant="ghost" size="md" block onClick={onDecline}>
          {COPY.decline}
        </Button>
      </div>
    </div>
  );
}

export interface PartnersSentProps {
  /** Recipients carried over from the review step (defaults to a small seed). */
  recipients?: { handle: string }[];
  /** Continue into care after the report locks. */
  onContinue?: (() => void) | undefined;
  /** Delete the whole report before it locks. */
  onDelete?: (() => void) | undefined;
}

export function PartnersSent({
  recipients = [{ handle: "sam" }, { handle: "leo" }],
  onContinue,
  onDelete,
}: PartnersSentProps) {
  const state = usePartnersSentState(recipients);
  if (state.locked) return <LockedView onContinue={onContinue} />;
  return <DraftView state={state} onDelete={onDelete} />;
}
