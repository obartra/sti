import { useState } from "react";
import { Button, Segmented } from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import type { ProtectionLabel, Route } from "../badge-card.tsx";
import { avatarSrc, type AvatarConfigInput } from "../../lib/avatars.ts";
import {
  TODAY,
  addDays,
  nextAction,
  MeansLine,
  QuickActionsRow,
  ReminderCard,
  RetestHint,
} from "./Home.parts.tsx";
import type { HomeBadge } from "./Home.parts.tsx";
import { CriteriaView } from "./Home.standing.tsx";
import { PauseBanner } from "./Home.pause.tsx";
import type { ReportPreview } from "../../core/report.ts";

// C1 Home (calm fold): the hero is one card that toggles between "what others
// see" (the badge a viewer resolves) and "your criteria" (the owner-only
// breakdown of where you stand), with the single next-best action under it. The
// rest is demoted so the status keeps the focus: a quiet one-line "what this
// means", a compact row of quick actions, and a re-test nudge that only becomes a
// full card when it is actually due. The badge is TWO-STATE only (blue / gray).
export type { HomeBadge };

// The two faces of the hero card. "shared" is the default so the honest mirror of
// what a viewer sees is the first thing the owner lands on; "criteria" is the
// private breakdown, never a viewer surface.
type HomeView = "shared" | "criteria";

// How close to the freshness lapse the re-test nudge earns a full card (vs the
// faint hint). Mirrors the inbox's "re-test soon" window.
const RETEST_SOON_DAYS = 14;

const VIEW_OPTIONS: { value: HomeView; label: string }[] = [
  { value: "shared", label: "What others see" },
  { value: "criteria", label: "Your criteria" },
];

function HomeHero({
  handle,
  avatar,
  viewerBadge,
  labels,
  route,
  isPaused,
  autoPaused,
  clearBy,
  onResume,
  onExtend,
  view,
  onView,
  standing,
  daysLeft,
  tested,
  onFindTesting,
}: {
  handle: string | undefined;
  avatar: AvatarConfigInput | undefined;
  viewerBadge: HomeBadge;
  labels: ProtectionLabel[];
  route: Route;
  isPaused: boolean;
  autoPaused: boolean;
  clearBy: Date;
  onResume: (() => void) | undefined;
  onExtend: (() => void) | undefined;
  view: HomeView;
  onView: (v: HomeView) => void;
  standing: ReportPreview;
  daysLeft: number;
  tested: boolean;
  onFindTesting: (() => void) | undefined;
}) {
  return (
    <>
      <div style={{ marginTop: 2 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {handle ? `Good to see you, @${handle}` : "Hey there!"}
        </h1>
      </div>

      <Segmented
        aria-label="Card view"
        value={view}
        onChange={onView}
        options={VIEW_OPTIONS}
      />

      {view === "shared" ? (
        <BadgeCard
          state={viewerBadge}
          labels={labels}
          route={route}
          identity={handle ? { handle } : null}
          avatarSrc={avatar !== undefined ? avatarSrc(avatar) : undefined}
          width="100%"
        />
      ) : (
        <CriteriaView
          standing={standing}
          daysLeft={daysLeft}
          tested={tested}
          onFindTesting={onFindTesting}
        />
      )}

      {isPaused && (
        <PauseBanner
          autoPaused={autoPaused}
          clearBy={clearBy}
          resume={onResume}
          onExtend={onExtend}
        />
      )}
    </>
  );
}

export interface HomeProps {
  // Owner-facing status that drives the next action.
  badge?: HomeBadge;
  // The viewer-facing state of the hero card (gray while paused).
  viewerBadge?: HomeBadge;
  labels?: ProtectionLabel[];
  route?: Route;
  // Handle shown on the hero card; also the avatar fallback when no config is set.
  handle?: string;
  // The owner's chosen avatar. Falls back to the handle-derived avatar in
  // isolation (Storybook), so the real app threads the config and stories don't.
  avatar?: AvatarConfigInput;
  paused?: boolean;
  autoPaused?: boolean;
  sharingMode?: "public" | "link";
  // Days left in the freshness window, for the re-test reminder.
  daysLeft?: number;
  // The owner-only "where you stand" breakdown (the three blue requirements and
  // whether the card is blue). Owner surface only; never shown to a viewer.
  standing?: ReportPreview;
  // Whether the owner has ever recorded a test (shapes the standing footer copy).
  tested?: boolean;
  // The auto-pause clearance date, for the auto-pause panel.
  clearBy?: Date;
  onShare?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
  // Kept for callers that still pass it; the Home "Preview" tile was folded into
  // the share surface, so it is no longer used here.
  onViewAs?: (() => void) | undefined;
  onPrivacy?: (() => void) | undefined;
  // Route to the testing finder (Care) from the "your criteria" view.
  onFindTesting?: (() => void) | undefined;
  onContinueCare?: (() => void) | undefined;
  onResume?: (() => void) | undefined;
  // Extend the clearance auto-pause by one window (persists; never shortens).
  onExtend?: (() => void) | undefined;
}

export function Home({
  badge = "blue",
  viewerBadge = "blue",
  labels = ["hiv"],
  route = null,
  handle,
  avatar,
  paused = false,
  autoPaused = false,
  daysLeft = 87,
  standing = { recentPanel: true, clear: true, route: true, willBeBlue: true },
  tested = true,
  clearBy = addDays(TODAY, 9),
  onShare,
  onReport,
  onPrivacy,
  onFindTesting,
  onContinueCare,
  onResume,
  onExtend,
}: HomeProps) {
  const isPaused = paused || autoPaused;
  const [view, setView] = useState<HomeView>("shared");
  const act = nextAction({
    badge,
    paused: isPaused,
    auto: autoPaused,
    resume: onResume,
    onContinueCare,
    onShare,
    onReport,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <HomeHero
        handle={handle}
        avatar={avatar}
        viewerBadge={viewerBadge}
        labels={labels}
        route={route}
        isPaused={isPaused}
        autoPaused={autoPaused}
        clearBy={clearBy}
        onResume={onResume}
        onExtend={onExtend}
        view={view}
        onView={setView}
        standing={standing}
        daysLeft={daysLeft}
        tested={tested}
        onFindTesting={onFindTesting}
      />

      <Button
        variant="primary"
        size="lg"
        block
        icon={act.icon}
        onClick={act.run}
      >
        {act.label}
      </Button>

      <HomeExtras
        isPaused={isPaused}
        viewerBadge={viewerBadge}
        daysLeft={daysLeft}
        onReport={onReport}
        onPrivacy={onPrivacy}
      />
    </div>
  );
}

// The demoted, below-the-hero content: a quiet meaning line, the compact quick
// actions, and the re-test nudge (all suppressed while paused; the nudge becomes a
// full card only when the freshness window is close to lapsing, else a faint
// hint). The "where you stand" breakdown is no longer here; it is the hero card's
// "your criteria" toggle.
function HomeExtras({
  isPaused,
  viewerBadge,
  daysLeft,
  onReport,
  onPrivacy,
}: {
  isPaused: boolean;
  viewerBadge: HomeBadge;
  daysLeft: number;
  onReport: (() => void) | undefined;
  onPrivacy: (() => void) | undefined;
}) {
  const retestDue = daysLeft <= RETEST_SOON_DAYS;
  return (
    <>
      {!isPaused && <MeansLine viewerBadge={viewerBadge} />}

      <QuickActionsRow onReport={onReport} onPrivacy={onPrivacy} />

      {!isPaused &&
        (retestDue ? (
          <ReminderCard daysLeft={daysLeft} />
        ) : (
          <RetestHint daysLeft={daysLeft} />
        ))}
    </>
  );
}
