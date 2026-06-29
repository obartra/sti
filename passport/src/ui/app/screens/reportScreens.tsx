import { Report, ReportSaved } from "../../core/Report.tsx";
import { Wallet } from "../../wallet/Wallet.tsx";
import type { ScreenRenderers } from "./context.ts";

export const reportRenderers: ScreenRenderers = {
  report: ({ nav, ownerState, onReport, setOwnerState }) => (
    <Report
      onBack={nav.back}
      onSavedPositive={() => nav.go("report-saved")}
      onSavedHome={() => nav.jump("home")}
      onLearn={(id) => nav.go("learn-detail", { id })}
      onApply={onReport}
      ownerState={ownerState}
      onSetOwnerState={setOwnerState}
    />
  ),
  "report-saved": ({ nav, owner }) => (
    <ReportSaved
      onDone={() => nav.jump("home")}
      viewerBadge={owner.viewerBadge}
      labels={owner.labels}
      blueRoute={owner.blueRoute}
      avatar={owner.avatar}
      {...(owner.handle !== undefined ? { handle: owner.handle } : {})}
    />
  ),
  wallet: ({ owner }) => (
    <Wallet
      sharingMode={owner.sharingMode}
      viewerBadge={owner.viewerBadge}
      labels={owner.labels}
      blueRoute={owner.blueRoute}
      avatar={owner.avatar}
    />
  ),
};
