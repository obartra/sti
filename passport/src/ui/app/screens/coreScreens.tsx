import { Home } from "../../core/Home.tsx";
import { Results } from "../../core/Results.tsx";
import { Care } from "../../core/Care.tsx";
import { Notifications } from "../../core/Notifications.tsx";
import { Privacy } from "../../core/Privacy.tsx";
import type { ScreenRenderers } from "./context.ts";

// Care's resource finders open public, US/CDC-aligned locators (per doc 03 §12:
// no single national condom program, so a maps search; clinic/testing via the
// CDC finder; PrEP via the open PrEP locator). External, static, no user data.
const RESOURCES = {
  clinic: "https://gettested.cdc.gov/",
  condoms:
    "https://www.google.com/maps/search/?api=1&query=free+condoms+near+me",
  prep: "https://preplocator.org/",
} as const;

function openResource(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

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
      onFindClinic={() => openResource(RESOURCES.clinic)}
      onLearnOfficial={() => openResource(RESOURCES.clinic)}
      onFindCondoms={() => openResource(RESOURCES.condoms)}
      onFindPrep={() => openResource(RESOURCES.prep)}
    />
  ),
  notifications: () => <Notifications />,
  privacy: ({ nav, ownerState, setOwnerState }) => (
    <Privacy
      ownerState={ownerState}
      setOwnerState={setOwnerState}
      onViewAs={() => nav.go("a2-public", { self: true })}
      onDeleted={() => nav.jump("a1-landing", "public")}
    />
  ),
};
