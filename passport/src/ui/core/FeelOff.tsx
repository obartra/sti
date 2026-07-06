import { Button } from "../../design/components/index.ts";
import { EyeOff, Eye, Stethoscope, Clock } from "../../design/icons.tsx";
import { ActionRow } from "../editorial/ActionRow.tsx";
import { cx } from "../../lib/cx.ts";
import "./feel-off.css";

// "Something feel off?" (doc 02): an owner-only, education-first way to pause for a
// transient episode and get seen. It frames pausing as the considerate, routine
// move, offers a one-tap pause, points to a non-diagnostic guide on the learn site,
// and lists the testing and PEP finders. HARD GUARDRAIL: it educates and points to
// "go get seen"; it never infers or names a condition. A pause looks identical to
// every other gray, so nothing here leaks a reason. Never shown logged out.
const COPY = {
  title: "Something feel off?",
  intro:
    "A new symptom, a scare, or just a hunch. Pausing your status while you get checked is the considerate move, and it takes a second. A pause looks like every other gray, so no one sees a reason.",
  pause: "Pause my status",
  pauseSub: "Lifts the moment you’re ready.",
  pausedTitle: "Your status is paused",
  pausedSub: "Everyone sees plain gray. No one sees why.",
  resume: "Resume sharing",
  recoverNote: "It stays paused while you recover, then lifts on its own.",
  checkEyebrow: "Get checked",
  symptomsTitle: "What’s worth getting checked",
  symptomsSub: "When to get seen, when to wait it out.",
  testingTitle: "Find testing",
  testingSub: "Free and low-cost near you. Many take walk-ins.",
  pepTitle: "PEP, if it has been under 72 hours",
  pepSub: "Emergency HIV prevention, time-sensitive.",
  footer:
    "This is general info, not medical advice. A clinic or doctor can tell you what’s right for you.",
} as const;

// The pause control. Not paused: a one-tap pause. Already paused: a calm
// confirmation, with Resume offered only when it is a manual pause (an auto-pause
// clearance window cannot be lifted before the guideline, so onResume is absent).
function PausePanel({
  paused,
  onPause,
  onResume,
}: {
  paused: boolean;
  onPause?: (() => void) | undefined;
  onResume?: (() => void) | undefined;
}) {
  if (paused) {
    return (
      <div className={cx("e-card", "fo__paused")}>
        <div className="fo__paused-title">{COPY.pausedTitle}</div>
        <div className="fo__paused-sub">
          {onResume ? COPY.pausedSub : COPY.recoverNote}
        </div>
        {onResume && (
          <button type="button" className="fo__resume" onClick={onResume}>
            {COPY.resume}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="fo__pause">
      <Button variant="primary" block onClick={onPause}>
        <EyeOff size={18} /> {COPY.pause}
      </Button>
      <div className="fo__pause-sub">{COPY.pauseSub}</div>
    </div>
  );
}

export interface FeelOffProps {
  /** Whether the status is already paused (manual or auto), so the panel confirms
   * rather than offering to pause again. */
  paused?: boolean;
  /** Pause the status (one tap). Absent while already paused. */
  onPause?: (() => void) | undefined;
  /** Resume sharing. Present only for a manual pause; an auto-pause window omits it. */
  onResume?: (() => void) | undefined;
  /** Open the non-diagnostic "what to check" guide on the learn site. */
  onLearnSymptoms?: (() => void) | undefined;
  /** Open the free-testing finder. */
  onFindTesting?: (() => void) | undefined;
  /** Open the PEP finder (time-critical HIV prevention). */
  onFindPep?: (() => void) | undefined;
}

export function FeelOff({
  paused = false,
  onPause,
  onResume,
  onLearnSymptoms,
  onFindTesting,
  onFindPep,
}: FeelOffProps) {
  return (
    <div className="fo">
      <h1 className="fo__title">{COPY.title}</h1>
      <p className="fo__intro">{COPY.intro}</p>

      <PausePanel paused={paused} onPause={onPause} onResume={onResume} />

      <div className="fo__section">{COPY.checkEyebrow}</div>
      <div className="fo__rows">
        <ActionRow
          lead={<Eye size={18} />}
          title={COPY.symptomsTitle}
          sub={COPY.symptomsSub}
          onClick={onLearnSymptoms}
        />
        <ActionRow
          lead={<Stethoscope size={18} />}
          title={COPY.testingTitle}
          sub={COPY.testingSub}
          onClick={onFindTesting}
        />
        <ActionRow
          lead={<Clock size={18} />}
          title={COPY.pepTitle}
          sub={COPY.pepSub}
          onClick={onFindPep}
        />
      </div>

      <div className="fo__footer">{COPY.footer}</div>
    </div>
  );
}
