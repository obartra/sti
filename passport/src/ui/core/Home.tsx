import { TODAY, addDays, fmtDate } from "./Home.parts.tsx";
import type { HomeBadge } from "./Home.parts.tsx";
import { avatarSrc, type AvatarConfigInput } from "../../lib/avatars.ts";
import type { ProtectionLabel, Route } from "../badge-card.tsx";
import { Avatar } from "../../design/components/index.ts";
import { StandingLine, NextTestCard, BlueChecklist } from "./Home.standing.tsx";
import { ViewerMirror } from "./Home.mirror.tsx";
import { HomeActions } from "./Home.actions.tsx";
import { PauseBanner } from "./Home.pause.tsx";
import { ContinuityNudgeCard } from "./ContinuityNudgeCard.tsx";
import type { ContinuityNudge } from "../app/continuityNudge.ts";
import { standingOf, nextTest } from "./Home.status.ts";
import type { ReportPreview } from "../../core/report.ts";
import "./home.css";

// Home is a single scannable dashboard, top to bottom: the owner's honest
// standing, the next test, the three things blue needs, what people see on your
// links, and the actions you'd take. No toggle between "your criteria" and "what
// others see"; the dashboard shows both the breakdown and the honest mirror at
// once. The status is always the real one, so a fresh owner reads "not set up",
// never green (doc 31 "Home").

// Two-letter initials for the avatar fallback: the first letter of the first two
// words, so a multi-word display name like "sam rivers" reads "SR", not "SA".
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Greeting({
  handle,
  avatar,
}: {
  handle: string | undefined;
  avatar: AvatarConfigInput | undefined;
}) {
  return (
    <div className="hm__head">
      <Avatar
        src={avatar !== undefined ? avatarSrc(avatar) : undefined}
        initials={initialsOf(handle ?? "you")}
        size="sm"
      />
      <h1 className="hm__title">
        {handle ? `Hi, ${handle}` : "Your passport"}
      </h1>
    </div>
  );
}

export interface HomeProps {
  // Owner-facing status that drives the standing and the primary action.
  badge?: HomeBadge;
  // The viewer-facing badge (gray while paused): the honest mirror.
  viewerBadge?: HomeBadge;
  labels?: ProtectionLabel[];
  route?: Route;
  // Handle shown on the greeting; also the avatar fallback when no config is set.
  handle?: string;
  // The owner's chosen avatar. Falls back to the handle-derived avatar in
  // isolation (Storybook), so the real app threads the config and stories don't.
  avatar?: AvatarConfigInput;
  paused?: boolean;
  autoPaused?: boolean;
  sharingMode?: "public" | "link";
  // Days left in the 90-day freshness window (0 when untested or lapsed).
  daysLeft?: number;
  // The owner-only "what blue needs" breakdown (the three requirements plus
  // whether the card is blue). Owner surface only; never shown to a viewer.
  standing?: ReportPreview;
  // Whether the owner has ever recorded a test. Distinguishes "not set up" (never
  // tested) from "time to re-test" (tested, then lapsed).
  tested?: boolean;
  // The auto-pause clearance date, for the pause panel.
  clearBy?: Date;
  onShare?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
  // Preview the viewer's-eye card (routes to the self public view).
  onViewAs?: (() => void) | undefined;
  onPrivacy?: (() => void) | undefined;
  onFindTesting?: (() => void) | undefined;
  onContinueCare?: (() => void) | undefined;
  onResume?: (() => void) | undefined;
  // Extend the clearance auto-pause by one window (persists; never shortens).
  onExtend?: (() => void) | undefined;
  // A due continuity reminder (doc 32), or null/undefined when none. Never blocks
  // anything; it only appears when rare cadence says so.
  continuityNudge?: ContinuityNudge | null;
  // Open Settings for the nudge (the phrase re-view or the password card).
  onNudgeSettings?: (() => void) | undefined;
  // Dismiss the nudge (records the time; a no-op to the account).
  onNudgeDismiss?: (() => void) | undefined;
}

// Story/isolation defaults, applied in one merge so the Home function stays
// under the complexity cap (per-field defaults each add a branch). The real app
// always threads every field via coreScreens, so these only shape Storybook.
const HOME_DEFAULTS = {
  badge: "blue",
  viewerBadge: "blue",
  labels: ["hiv"],
  route: null,
  paused: false,
  autoPaused: false,
  daysLeft: 87,
  standing: { recentPanel: true, clear: true, route: true, willBeBlue: true },
  tested: true,
} as const satisfies Partial<HomeProps>;

export function Home(props: HomeProps) {
  const {
    badge,
    viewerBadge,
    labels,
    route,
    handle,
    avatar,
    paused,
    autoPaused,
    daysLeft,
    standing,
    tested,
    onShare,
    onReport,
    onViewAs,
    onPrivacy,
    onFindTesting,
    onContinueCare,
    onResume,
    onExtend,
    continuityNudge,
    onNudgeSettings,
    onNudgeDismiss,
  } = { ...HOME_DEFAULTS, ...props };
  const isPaused = paused || autoPaused;
  const clearBy = props.clearBy ?? addDays(TODAY, 9);
  const status = standingOf({ badge, paused: isPaused, tested, daysLeft });
  const next = nextTest(status, daysLeft, fmtDate(addDays(TODAY, daysLeft)));
  const care = onContinueCare ?? onFindTesting;

  return (
    <div className="hm">
      <Greeting handle={handle} avatar={avatar} />

      <StandingLine standing={status} />

      {continuityNudge && onNudgeSettings && onNudgeDismiss && (
        <ContinuityNudgeCard
          kind={continuityNudge}
          onGoToSettings={onNudgeSettings}
          onDismiss={onNudgeDismiss}
        />
      )}

      {isPaused ? (
        <PauseBanner
          autoPaused={autoPaused}
          clearBy={clearBy}
          resume={onResume}
          onExtend={onExtend}
        />
      ) : (
        <>
          <NextTestCard next={next} onFindTesting={onFindTesting} />
          <BlueChecklist
            standing={standing}
            actions={{
              onReport,
              onFindTesting,
              onPrevention: onPrivacy,
            }}
          />
        </>
      )}

      <ViewerMirror
        viewerBadge={viewerBadge}
        labels={labels}
        route={route}
        onViewAs={onViewAs}
        onManageLinks={onPrivacy}
      />

      <HomeActions
        standing={status}
        onShare={onShare}
        onReport={onReport}
        onFindCare={care}
      />
    </div>
  );
}
