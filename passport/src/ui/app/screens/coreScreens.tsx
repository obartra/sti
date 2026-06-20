import { Home } from "../../core/Home.tsx";
import { Results } from "../../core/Results.tsx";
import { Care } from "../../core/Care.tsx";
import { Notifications } from "../../core/Notifications.tsx";
import { Privacy } from "../../core/Privacy.tsx";
import type { ScreenRenderers } from "./context.ts";

export const coreRenderers: ScreenRenderers = {
  home: ({ nav, owner, openShare }) => (
    <Home
      badge={owner.badge}
      viewerBadge={owner.viewerBadge}
      labels={owner.labels}
      route={owner.blueRoute}
      handle={owner.handle}
      avatar={owner.avatar}
      paused={owner.paused}
      autoPaused={owner.autoPaused}
      sharingMode={owner.sharingMode}
      daysLeft={owner.daysLeft}
      onShare={openShare}
      onReport={() => nav.go("report")}
      onViewAs={() => nav.go("a2-public", { self: true })}
      onPrivacy={() => nav.go("privacy")}
      onContinueCare={() => nav.go("care")}
    />
  ),
  results: () => <Results />,
  care: ({ nav, owner }) => (
    <Care
      badge={owner.badge}
      onLearn={() => nav.go("learn")}
      onPartners={() => nav.go("partners")}
    />
  ),
  notifications: () => <Notifications />,
  privacy: ({ nav }) => (
    <Privacy
      onViewAs={() => nav.go("a2-public", { self: true })}
      onDeleted={() => nav.jump("a1-landing", "public")}
    />
  ),
};
