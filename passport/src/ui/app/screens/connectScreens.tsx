import { Connect } from "../../connect/Connect.tsx";
import { ContactLinks } from "../../connect/ContactLinks.tsx";
import { QrScanner } from "../../connect/QrScanner.tsx";
import { todayEpochDay, nowMs } from "../../../core/clock.ts";
import { avatarSrc } from "../../../lib/avatars.ts";
import type { ScreenRenderers } from "./context.ts";

export const connectRenderers: ScreenRenderers = {
  connect: ({ nav, contacts, faves, onToggleFave, onRevokeContact }) => (
    <Connect
      contacts={contacts}
      nowDay={todayEpochDay()}
      faves={faves}
      onToggleFave={onToggleFave}
      onRemoveContact={onRevokeContact}
      onShareLink={() => nav.go("alias-share")}
      onScan={() => nav.go("scan")}
    />
  ),
  // Scan someone's QR to open their passport: a decoded alias link routes to the
  // public resolution screen (the same flow as opening the link in a browser).
  scan: ({ nav }) => (
    <QrScanner
      onResult={(link) => nav.go("a2-public", { id: link.id, key: link.key })}
      onBack={nav.back}
    />
  ),
  // "Share a link" is now the per-contact link manager: mint a private link for
  // one person, list active links, revoke each (doc 13, slice 1).
  "alias-share": ({
    nav,
    owner,
    contacts,
    onCreateContactLink,
    onRenameContact,
    onRevokeContact,
    onSetContactDuration,
    onIngestContactReturn,
  }) => (
    <ContactLinks
      contacts={contacts}
      now={nowMs()}
      onCreate={onCreateContactLink}
      onRename={onRenameContact}
      onRevoke={onRevokeContact}
      onSetDuration={onSetContactDuration}
      onIngestReturn={onIngestContactReturn}
      canShowName={owner.handle !== undefined && owner.handle !== ""}
      avatarSrc={avatarSrc(owner.avatar)}
      onEditAvatar={() => nav.go("avatar-edit")}
    />
  ),
};
