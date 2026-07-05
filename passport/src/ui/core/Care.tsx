import { Button } from "../../design/components/index.ts";
import {
  MapPin,
  Stethoscope,
  Shield,
  Heart,
  Phone,
  Clock,
  Eye,
} from "../../design/icons.tsx";
import { ActionRow } from "../editorial/ActionRow.tsx";
import { cx } from "../../lib/cx.ts";
import "./care.css";

// Care: testing, at-home screening, local resource finders, and learn-and-talk
// rows. The app's mini library (doc 37), so it reads like one: the find-testing
// moment is the one action callout, everything else is hairline rows with muted
// stroke icons on the page surface. The `badge` is TWO-STATE only (blue /
// gray): a gray viewer (no status yet) additionally sees the at-home screening
// prompt. There is no four-light status here.
const COPY = {
  care: {
    title: "Care",
    getTestedEyebrow: "Get tested",
    getTested: "Free and low-cost testing near you. Many take walk-ins.",
    findClinic: "Find a clinic",
    heymistrEyebrow: "At-home screening",
    heymistr:
      "New to testing? Heymistr ships discreet at-home screening kits on a regular schedule.",
    heymistrCta: "Sign up",
    feelOffTitle: "Something feel off?",
    feelOffSub: "Pause and get checked, privately.",
    resourcesEyebrow: "Free and low-cost near you",
    // PEP is post-exposure and time-critical (under 72h), so it leads the resource
    // finders. Copy matches the public /exposed page for one voice across surfaces.
    pepTitle: "PEP, if it has been under 72 hours",
    pepSub: "Emergency HIV prevention, time-sensitive",
    condomsTitle: "Find free condoms near you",
    condomsSub:
      "Health centers and community programs that hand them out at no cost.",
    prepTitle: "Find free or low-cost PrEP near you",
    prepSub:
      "Daily HIV-prevention pill. Many clinics offer it free or on a sliding scale.",
    finderCta: "Find a clinic near you",
    learn: "Learn and talk",
    rows: [
      ["How your passport works", "What’s shared, what stays private"],
      ["Talk to someone", "CDC-INFO · free and confidential · 24/7"],
    ],
    talkNumber: "18002324636",
    callLabel: "Call CDC-INFO",
  },
  learn: {
    title: "STI basics",
    sub: "Learn and share what to do. No judgment. One page each.",
    testingTitle: "Getting tested, what to expect",
    testingSub: "The whole visit, start to finish. Quicker than you think.",
    official: "Or see the official CDC testing list",
    footer:
      "This is general info, not medical advice. A clinic or doctor can tell you what is right for you. Based on U.S. CDC guidance.",
  },
} as const;

// Two-state badge: "blue" (has a status) or "gray" (no status yet). The at-home
// screening prompt only shows for "gray". This is the approved two-state model,
// never a four-light status.
type CareBadge = "blue" | "gray";

export interface CareProps {
  badge?: CareBadge;
  /** Open the owner-only "something feel off?" pause-and-get-seen surface (doc 02).
   * Absent for a logged-out viewer, who never sees it. */
  onFeelOff?: (() => void) | undefined;
  onFindClinic?: (() => void) | undefined;
  onLearnOfficial?: (() => void) | undefined;
  onHeymistr?: (() => void) | undefined;
  onFindCondoms?: (() => void) | undefined;
  onFindPep?: (() => void) | undefined;
  onFindPrep?: (() => void) | undefined;
  onLearn?: (() => void) | undefined;
  onLearnTesting?: (() => void) | undefined;
}

// The one action callout: find testing. The old filled-teal hero (glow, white
// text) dies here; the callout carries the same content on the editorial card.
function GetTestedCallout({
  onFindClinic,
  onLearnOfficial,
}: {
  onFindClinic?: (() => void) | undefined;
  onLearnOfficial?: (() => void) | undefined;
}) {
  const c = COPY.care;
  return (
    <div className={cx("e-card", "care__hero")}>
      <div className="care__hero-eyebrow">
        <span aria-hidden className="care__hero-eyebrow-icon">
          <MapPin size={16} />
        </span>
        {c.getTestedEyebrow}
      </div>
      <div className="care__hero-line">{c.getTested}</div>
      <div className="care__hero-actions">
        <Button variant="primary" onClick={onFindClinic}>
          {c.findClinic}
        </Button>
        <button
          type="button"
          onClick={onLearnOfficial}
          className="care__hero-alt"
        >
          {COPY.learn.official}
        </button>
      </div>
    </div>
  );
}

function HeymistrAside({
  onHeymistr,
}: {
  onHeymistr?: (() => void) | undefined;
}) {
  const c = COPY.care;
  return (
    <div className="care__aside">
      <span aria-hidden className="care__aside-icon">
        <Stethoscope size={20} />
      </span>
      <div className="care__aside-body">
        <div className="care__aside-eyebrow">{c.heymistrEyebrow}</div>
        <div className="care__aside-text">{c.heymistr}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onHeymistr}>
        {c.heymistrCta}
      </Button>
    </div>
  );
}

function LearnRows({
  onLearn,
  onLearnTesting,
}: {
  onLearn?: (() => void) | undefined;
  onLearnTesting?: (() => void) | undefined;
}) {
  const c = COPY.care;
  return (
    <div className="care__rows">
      <ActionRow
        lead={<Heart size={18} />}
        title={COPY.learn.title}
        sub={COPY.learn.sub}
        onClick={onLearn}
      />
      <ActionRow
        lead={<Stethoscope size={18} />}
        title={COPY.learn.testingTitle}
        sub={COPY.learn.testingSub}
        onClick={onLearnTesting}
      />
      <ActionRow
        lead={<Shield size={18} />}
        title={c.rows[0][0]}
        sub={c.rows[0][1]}
      />
      <ActionRow
        lead={<Phone size={18} />}
        title={c.rows[1][0]}
        sub={c.rows[1][1]}
        onClick={() => {
          window.location.href = "tel:" + c.talkNumber;
        }}
      />
    </div>
  );
}

export function Care({
  badge = "gray",
  onFeelOff,
  onFindClinic,
  onLearnOfficial,
  onHeymistr,
  onFindCondoms,
  onFindPep,
  onFindPrep,
  onLearn,
  onLearnTesting,
}: CareProps) {
  const c = COPY.care;
  return (
    <div className="care">
      <h1 className="care__title">{c.title}</h1>

      <GetTestedCallout
        onFindClinic={onFindClinic}
        onLearnOfficial={onLearnOfficial}
      />

      {badge === "gray" && <HeymistrAside onHeymistr={onHeymistr} />}

      {onFeelOff && (
        <div className="care__rows">
          <ActionRow
            lead={<Eye size={18} />}
            title={c.feelOffTitle}
            sub={c.feelOffSub}
            onClick={onFeelOff}
          />
        </div>
      )}

      <div className="care__section">{c.resourcesEyebrow}</div>
      <div className="care__rows">
        <ActionRow
          lead={<Clock size={18} />}
          title={c.pepTitle}
          sub={c.pepSub}
          onClick={onFindPep}
        />
        <ActionRow
          lead={<Shield size={18} />}
          title={c.condomsTitle}
          sub={c.condomsSub}
          onClick={onFindCondoms}
        />
        <ActionRow
          lead={<Stethoscope size={18} />}
          title={c.prepTitle}
          sub={c.prepSub}
          onClick={onFindPrep}
        />
      </div>

      <div className="care__section">{c.learn}</div>
      <LearnRows onLearn={onLearn} onLearnTesting={onLearnTesting} />

      <div className="care__footer">{COPY.learn.footer}</div>
    </div>
  );
}
