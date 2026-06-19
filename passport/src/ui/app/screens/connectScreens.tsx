import { Connect } from "../../connect/Connect.tsx";
import { Linkup } from "../../connect/Linkup.tsx";
import { ScanLink } from "../../connect/ScanLink.tsx";
import { ShareLink } from "../../connect/ShareLink.tsx";
import type { ScreenRenderers } from "./context.ts";

export const connectRenderers: ScreenRenderers = {
  connect: ({ nav }) => (
    <Connect
      onLinkup={() => nav.go("linkup")}
      onScanLink={() => nav.go("scan-link")}
      onShareLink={() => nav.go("alias-share")}
    />
  ),
  linkup: ({ nav }) => <Linkup onDone={nav.back} />,
  "scan-link": ({ nav }) => <ScanLink onCancel={nav.back} />,
  "alias-share": ({ nav, owner }) => (
    <ShareLink
      onDone={nav.back}
      sharingMode={owner.sharingMode === "public" ? "public" : "private"}
      avatarId={owner.avatarId}
    />
  ),
};
