import { Report, ReportSaved } from "../../core/Report.tsx";
import { Partners, PartnersSent } from "../../core/Partners.tsx";
import { Wallet } from "../../wallet/Wallet.tsx";
import type { ScreenRenderers } from "./context.ts";

export const reportRenderers: ScreenRenderers = {
  report: ({ nav, owner }) => (
    <Report
      onBack={nav.back}
      onSavedPositive={() => nav.go("report-saved")}
      onSavedHome={() => nav.jump("home")}
      onLearn={(id) => nav.go("learn-detail", { id })}
      lastTestedLabel={owner.lastTestedLabel}
    />
  ),
  "report-saved": ({ nav, owner }) => (
    <ReportSaved
      onReviewPartners={() => nav.go("partners")}
      onDone={() => nav.jump("home")}
      viewerBadge={owner.viewerBadge}
      labels={owner.labels}
      blueRoute={owner.blueRoute}
      avatarId={owner.avatarId}
      handle={owner.handle}
    />
  ),
  partners: ({ nav }) => (
    <Partners
      onPreviewAlert={() => nav.go("a3-alert", { preview: true })}
      onSend={() => nav.go("partners-sent")}
      onDecline={() => nav.jump("home")}
    />
  ),
  "partners-sent": ({ nav }) => (
    <PartnersSent
      onContinue={() => nav.go("care")}
      onDelete={() => nav.jump("home")}
    />
  ),
  wallet: ({ owner }) => (
    <Wallet
      sharingMode={owner.sharingMode}
      viewerBadge={owner.viewerBadge}
      labels={owner.labels}
      blueRoute={owner.blueRoute}
      avatarId={owner.avatarId}
    />
  ),
};
