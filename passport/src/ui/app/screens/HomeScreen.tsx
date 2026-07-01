import { Home } from "../../core/Home.tsx";
import { useContinuityNudge } from "../useContinuityNudge.ts";
import type { ScreenCtx } from "./context.ts";
import { blueChecklist, extendClearance } from "../../../core/report.ts";
import { todayEpochDay } from "../../../core/clock.ts";

// The Home dashboard wired to its context, wrapped so it can own the device-local
// continuity nudge (doc 32) via a hook. A password factor is "set" when the owner
// holds a recovery name; the nudge is shown only for a logged-in owner (a
// logged-out preview has no way back in to rehearse and no Settings to open).
export function HomeScreen({
  nav,
  owner,
  ownerState,
  openShare,
  setOwnerState,
  recoveryName,
  isLoggedIn,
}: ScreenCtx) {
  const { nudge, dismiss } = useContinuityNudge(recoveryName !== null);
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
      sharingMode={owner.sharingMode}
      daysLeft={owner.daysLeft}
      standing={blueChecklist(ownerState, todayEpochDay())}
      tested={ownerState.testing.lastPanelDay !== null}
      onShare={openShare}
      onReport={() => nav.go("report")}
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
