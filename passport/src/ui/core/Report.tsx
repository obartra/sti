import {
  Button,
  Card,
  Segmented,
  Switch,
  Field,
  Input,
} from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import { avatarSrc, type AvatarConfigInput } from "../../lib/avatars.ts";
import { Check, Lock, Users, Circles } from "../../design/icons.tsx";
import {
  COPY,
  fieldLbl,
  reportOutcome,
  useReportState,
} from "./Report.parts.tsx";
import type { ReportState } from "./Report.parts.tsx";
import type { ReportOutcome } from "../../core/report.ts";
import { AllClearCard, ChronicCard } from "./Report.cards.tsx";
import { DetailEntry } from "./Report.infection.tsx";

export interface ReportProps {
  /** Navigate back (the prototype's nav.back). */
  onBack?: (() => void) | undefined;
  /** Reported a positive: go to the confirmation step (nav("report-saved")). */
  onSavedPositive?: (() => void) | undefined;
  /** Saved with no positive: return home (nav("home", "app")). */
  onSavedHome?: (() => void) | undefined;
  /** Open the Learn explainer for an infection (nav("learn-detail", ...)). */
  onLearn?: ((id: string) => void) | undefined;
  /** Persist the derived badge inputs (the prototype's setTweak). */
  onTweak?: ((tweak: Record<string, string>) => void) | undefined;
  /** Apply the reported result to the real owner state (the wired app). */
  onApply?: ((outcome: ReportOutcome) => void) | undefined;
  /** Pre-fill the date-tested field (the prototype's t.f.lastTestedLabel). */
  lastTestedLabel?: string;
}

interface SaveArgs {
  state: ReportState;
  onTweak?: ((tweak: Record<string, string>) => void) | undefined;
  onApply?: ((outcome: ReportOutcome) => void) | undefined;
  onSavedPositive?: (() => void) | undefined;
  onSavedHome?: (() => void) | undefined;
}

// Two states only. We write the computing INPUTS (recency / clearance /
// pause), never a direct badge, the badge derives. A positive -> gray +
// on-device auto-pause (clearance window), identical to every other gray.
// An all-clear panel that is core-INCOMPLETE does NOT earn blue: it isn't a
// qualifying current test, so it stays gray (modelled as non-fresh recency),
// never a half-blue. A complete clear core panel -> blue.
function runSave({
  state,
  onTweak,
  onApply,
  onSavedPositive,
  onSavedHome,
}: SaveArgs) {
  const { onPassport, anyPositive, detail, coreComplete } = state;
  if (onPassport) {
    if (anyPositive) onTweak?.({ clearance: "positive", pauseMode: "auto" });
    else if (!detail || coreComplete)
      onTweak?.({ recency: "fresh", clearance: "clear", pauseMode: "none" });
    else
      onTweak?.({ recency: "lapsed", clearance: "clear", pauseMode: "none" });
    // The wired app: apply the result to the real owner state (recomputes the
    // badge and republishes shared links). Gated on onPassport like the badge.
    onApply?.(reportOutcome(state));
  }
  if (anyPositive) onSavedPositive?.();
  else onSavedHome?.();
}

// Privacy reassurance shown once any positive is entered: a positive only ever
// reads as gray, never as a labeled status.
function PrivacyNoteCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card variant="tint" style={{ display: "flex", gap: 12 }}>
        <span
          style={{
            color: "var(--text-accent)",
            flex: "none",
            marginTop: 1,
          }}
        >
          <Lock size={18} />
        </span>
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {COPY.privacyNoteTitle}
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--text-body)",
              marginTop: 2,
            }}
          >
            {COPY.privacyNote}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function Report({
  onBack,
  onSavedPositive,
  onSavedHome,
  onLearn,
  onTweak,
  onApply,
  lastTestedLabel = "7 Jun 2026",
}: ReportProps) {
  const c = COPY;
  const state = useReportState();
  const { detail, anyPositive, anyChronicPositive, anyEntered } = state;
  const save = () => {
    runSave({ state, onTweak, onApply, onSavedPositive, onSavedHome });
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {c.title}
      </h1>

      <Segmented<string>
        options={[
          { value: c.modeAll, label: c.modeAll },
          { value: c.modeDetail, label: c.modeDetail },
        ]}
        value={state.mode}
        onChange={state.setMode}
      />

      {!detail ? (
        <AllClearCard />
      ) : (
        <DetailEntry state={state} onLearn={onLearn} />
      )}

      {anyPositive && <PrivacyNoteCard />}

      {/* Chronic, lifelong-manageable diagnosis (HSV/HPV): education only, it
          never grays the badge. Outbreak -> the considerate move is Pause. */}
      {anyChronicPositive && (
        <ChronicCard herpesPositive={state.val("herpes") === "Positive"} />
      )}

      {/* Display-only today: the value is never read, and applyReport records
          the result as tested-today. If this becomes editable, applyReport must
          derive lastPanelAgeDays from it (an old date must not read as fresh). */}
      <Field label={<span style={fieldLbl}>{c.dateLabel}</span>}>
        <Input defaultValue={lastTestedLabel} />
      </Field>
      <Card
        variant="flat"
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-strong)",
            }}
          >
            {c.onPassportTitle}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {c.onPassportSub}
          </div>
        </div>
        <Switch checked={state.onPassport} onChange={state.setOnPassport} />
      </Card>
      <div style={{ display: "flex", gap: 12 }}>
        <Button variant="quiet" size="lg" onClick={onBack}>
          {c.cancel}
        </Button>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!anyEntered}
          onClick={save}
        >
          {c.save}
        </Button>
      </div>
    </div>
  );
}

function SavedHeader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <span
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={36} />
      </span>
      <h1
        style={{
          fontSize: 23,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        Result saved
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--text-body)",
          margin: 0,
          maxWidth: 300,
        }}
      >
        Your card shows no status to others right now, gray, like any other
        reason a card isn’t current. It never names what you tested for.
      </p>
    </div>
  );
}

// circles are notified automatically too, transparency, not consent.
// Circle exposure is merged into the same contentless pipeline, one plain
// line, nothing to review, no scope view, no count.
function CirclesNote() {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
    >
      <span
        style={{
          flex: "none",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Circles size={19} />
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
        }}
      >
        Recent contacts, including anyone you share a circle with, get the same
        anonymous heads-up. There’s nothing to review or send.
      </div>
    </Card>
  );
}

export interface ReportSavedProps {
  /** Go to the partner-alert review (the prototype's nav("partners")). */
  onReviewPartners?: (() => void) | undefined;
  /** Skip for now, return home (nav("home", "app")). */
  onDone?: (() => void) | undefined;
  /** The viewer-facing two-state badge to show after saving. */
  viewerBadge?: BadgeState;
  /** Protection labels carried on the badge card. */
  labels?: ProtectionLabel[];
  /** The blue-card route label. */
  blueRoute?: Route;
  /** Avatar for the badge card (config or seed). */
  avatar?: AvatarConfigInput;
  /** Handle shown on the badge card identity row. */
  handle?: string;
}

export function ReportSaved({
  onReviewPartners,
  onDone,
  viewerBadge = "gray",
  labels = [],
  blueRoute = null,
  avatar = 0,
  handle = "robin",
}: ReportSavedProps) {
  const c = COPY;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        paddingTop: 8,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <SavedHeader />
      <BadgeCard
        state={viewerBadge}
        labels={labels}
        route={blueRoute}
        identity={{ handle }}
        avatarSrc={avatarSrc(avatar)}
        width="100%"
      />

      <CirclesNote />
      <Card
        variant="tint"
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div
          style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {c.promptTitle}
        </div>
        <div
          style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-body)" }}
        >
          {c.promptBody}
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button
          variant="primary"
          size="lg"
          block
          icon={<Users size={18} />}
          onClick={onReviewPartners}
        >
          {c.promptYes}
        </Button>
        <Button variant="ghost" size="md" block onClick={onDone}>
          {c.promptNo}
        </Button>
      </div>
    </div>
  );
}
