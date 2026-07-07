import { Home } from "../../core/Home.tsx";
import { useContinuityNudge } from "../useContinuityNudge.ts";
import type { ScreenCtx } from "./context.ts";
import { blueChecklist, extendClearance } from "../../../core/report.ts";
import { todayEpochDay } from "../../../core/clock.ts";

// The Home dashboard wired to its context, wrapped so it can own the continuity
// nudge (doc 32) via a hook. The yearly password reminder is driven by the synced
// `passwordSetAt` (the real set/changed date), while the dismissal cadence stays
// device-local; the nudge is shown only for a logged-in owner (a logged-out preview
// has no way back in to rehearse and no Settings to open).
export function HomeScreen({
  nav,
  owner,
  ownerState,
  openShare,
  setOwnerState,
  passwordSetAt,
  isLoggedIn,
}: ScreenCtx) {
  const { nudge, dismiss } = useContinuityNudge(passwordSetAt);
  return (
    <Home
      badge={owner.badge}
      viewerBadge={owner.viewerBadge}
      labels={owner.labels}
      route={owner.blueRoute}
      {...(owner.handle !== undefined ? { handle: owner.handle } : {})}
      avatar={owner.avatar}
      paused={owner.paused}
      autoPaused={owner.autoPaused}
      clearBy={owner.clearBy}
      daysLeft={owner.daysLeft}
      standing={blueChecklist(ownerState, todayEpochDay())}
      tested={ownerState.testing.lastPanelDay !== null}
      onShare={openShare}
      onReport={() => nav.go("report")}
      onFeelOff={() => nav.go("feel-off")}
      onViewAs={() => nav.go("a2-public", { self: true })}
      onPrivacy={() => nav.go("privacy")}
      onFindTesting={() => nav.go("care")}
      onContinueCare={() => nav.go("care")}
      onExtend={() => setOwnerState((s) => extendClearance(s, todayEpochDay()))}
      continuityNudge={isLoggedIn ? nudge : null}
      onNudgeSettings={() => nav.go("privacy")}
      onNudgeDismiss={dismiss}
    />
  );
}
