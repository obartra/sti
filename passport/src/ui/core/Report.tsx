import { useState } from "react";
import { Button, Switch, Field, Input } from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import { avatarSrc, type AvatarConfigInput } from "../../lib/avatars.ts";
import { Check, Lock } from "../../design/icons.tsx";
import { COPY, reportOutcome, useReportState } from "./Report.parts.tsx";
import type { ReportState } from "./Report.parts.tsx";
import { previewReport, type ReportOutcome } from "../../core/report.ts";
import "./report.css";
import {
  INITIAL_OWNER_STATE,
  condomRoutePresent,
  type OwnerState,
} from "../../core/badge.ts";
import { withPrep, withCondomRoute } from "../../core/route.ts";
import {
  todayEpochDay,
  epochDayToISODate,
  isoDateToEpochDay,
} from "../../core/clock.ts";
import { DetailEntry } from "./Report.infection.tsx";
import { BlueReadiness, RouteControls } from "./Report.route.tsx";
import { ShareHeadsUp } from "./Report.share.tsx";

export interface ReportProps {
  /** Navigate back (the prototype's nav.back). */
  onBack?: (() => void) | undefined;
  /** Reported a positive: go to the confirmation step (nav("report-saved")). */
  onSavedPositive?: (() => void) | undefined;
  /** Saved with no positive: return home (nav("home", "app")). */
  onSavedHome?: (() => void) | undefined;
  /** Open the education explainer for an infection on info.sti.care (doc 34). */
  onLearn?: ((id: string) => void) | undefined;
  /** Open the "something feel off?" pause-and-get-seen surface (doc 02), for when
   * the owner is not ready to log a result and wants to pause instead. */
  onFeelOff?: (() => void) | undefined;
  /** Persist the derived badge inputs (the prototype's setTweak). */
  onTweak?: ((tweak: Record<string, string>) => void) | undefined;
  /** Apply the reported result to the real owner state (the wired app). */
  onApply?: ((outcome: ReportOutcome) => void) | undefined;
  /** The owner's current state, for the live "what blue needs" preview + routes. */
  ownerState?: OwnerState;
  /** Persist a route toggle (PrEP / condoms-always) to the owner state. */
  onSetOwnerState?:
    | ((update: (prev: OwnerState) => OwnerState) => void)
    | undefined;
  /** The clock edge as an epoch day. Defaults to the device's today; stories
   * and tests pin it so dated renders (the "Date tested" default) stay
   * deterministic instead of drifting with the wall clock. */
  today?: number;
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
  const { onPassport, anyPositive, coreComplete } = state;
  if (onPassport) {
    if (anyPositive) onTweak?.({ clearance: "positive", pauseMode: "auto" });
    else if (coreComplete)
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
    <div className="rp__aside">
      <span aria-hidden className="rp__aside-icon">
        <Lock size={18} />
      </span>
      <div>
        <div className="rp__aside-title">{COPY.privacyNoteTitle}</div>
        <div className="rp__aside-text">{COPY.privacyNote}</div>
      </div>
    </div>
  );
}

// The "Date tested" picker, the passport toggle, and the save/cancel bar. The
// date is a real date input, capped at today and written back as an epoch day,
// so a back-dated test ages from when it was taken instead of reading as fresh.
function ReportFooter({
  state,
  anyEntered,
  today,
  onBack,
  onSave,
}: {
  state: ReportState;
  anyEntered: boolean;
  today: number;
  onBack?: (() => void) | undefined;
  onSave: () => void;
}) {
  const c = COPY;
  return (
    <>
      <Field
        label={<span className="rp__field-label">{c.dateLabel}</span>}
        hint={c.dateHint}
      >
        <Input
          type="date"
          value={epochDayToISODate(state.panelDay)}
          max={epochDayToISODate(today)}
          onChange={(e) => {
            const day = isoDateToEpochDay(e.target.value);
            if (day !== null) state.setPanelDay(day);
          }}
        />
      </Field>
      <div className="rp__passport">
        <div className="rp__passport-body">
          <div className="rp__passport-title">{c.onPassportTitle}</div>
          <div className="rp__passport-sub">{c.onPassportSub}</div>
        </div>
        <Switch checked={state.onPassport} onChange={state.setOnPassport} />
      </div>
      <div className="rp__actions">
        <Button variant="quiet" size="lg" onClick={onBack}>
          {c.cancel}
        </Button>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!anyEntered}
          onClick={onSave}
        >
          {c.save}
        </Button>
      </div>
    </>
  );
}

export function Report({
  onBack,
  onSavedPositive,
  onSavedHome,
  onLearn,
  onFeelOff,
  onTweak,
  onApply,
  ownerState = INITIAL_OWNER_STATE,
  onSetOwnerState,
  today = todayEpochDay(),
}: ReportProps) {
  const c = COPY;
  const state = useReportState(today);
  const { anyPositive, anyEntered } = state;
  // Route toggles mirror Settings: they write the owner state immediately (so
  // they count toward blue) AND drive the local preview before the parent
  // re-renders. Stories with no setter still toggle via the local copy.
  const [prep, setPrep] = useState(ownerState.onPrep);
  const [condoms, setCondoms] = useState(condomRoutePresent(ownerState));
  const togglePrep = (v: boolean) => {
    setPrep(v);
    onSetOwnerState?.((s) => withPrep(s, v));
  };
  const toggleCondoms = (v: boolean) => {
    setCondoms(v);
    onSetOwnerState?.((s) => withCondomRoute(s, v));
  };
  const base = withCondomRoute(withPrep(ownerState, prep), condoms);
  const preview = previewReport(base, reportOutcome(state), today);
  const save = () => {
    runSave({ state, onTweak, onApply, onSavedPositive, onSavedHome });
  };
  return (
    <div className="rp">
      <h1 className="rp__title">{c.title}</h1>

      {onFeelOff && (
        <button type="button" className="rp__feeloff" onClick={onFeelOff}>
          Something feel off? Pause instead.
        </button>
      )}

      <BlueReadiness preview={preview} />

      <DetailEntry state={state} onLearn={onLearn} />

      <RouteControls
        prep={prep}
        condoms={condoms}
        onPrep={togglePrep}
        onCondoms={toggleCondoms}
      />

      {anyPositive && <PrivacyNoteCard />}

      <ReportFooter
        state={state}
        anyEntered={anyEntered}
        today={today}
        onBack={onBack}
        onSave={save}
      />
    </div>
  );
}

function SavedHeader() {
  return (
    <div className="rp__saved-head">
      <span aria-hidden className="rp__saved-icon">
        <Check size={36} />
      </span>
      <h1 className="rp__saved-title">Result saved</h1>
      <p className="rp__saved-sub">
        Your card shows gray to others, like any other reason a card isn’t
        current. It never names what you tested for.
      </p>
    </div>
  );
}

export interface ReportSavedProps {
  /** Return home (nav("home", "app")). */
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

// After a report this screen affirms first; notifying LINKED contacts happens
// quietly in the background and is never mentioned (the report moment is the worst
// place for a notification chore). The only optional action is a pre-written
// heads-up the user can send to someone who ISN'T on sti.care, framed as an easy
// favor, not a duty: Done sits below it so nothing here feels owed.
export function ReportSaved({
  onDone,
  viewerBadge = "gray",
  labels = [],
  blueRoute = null,
  avatar = 0,
  handle = "robin",
}: ReportSavedProps) {
  return (
    <div className="rp__saved">
      <SavedHeader />
      <BadgeCard
        state={viewerBadge}
        labels={labels}
        route={blueRoute}
        identity={{ handle }}
        avatarSrc={avatarSrc(avatar)}
        width="100%"
      />
      <hr className="e-rule" />
      <ShareHeadsUp />
      <Button variant="primary" size="lg" block onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
