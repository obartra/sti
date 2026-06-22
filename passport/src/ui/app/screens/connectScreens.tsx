import { Connect } from "../../connect/Connect.tsx";
import { ContactLinks } from "../../connect/ContactLinks.tsx";
import { todayEpochDay } from "../../../core/clock.ts";
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
    />
  ),
  // "Share a link" is now the per-contact link manager: mint a private link for
  // one person, list active links, revoke each (doc 13, slice 1).
  "alias-share": ({
    contacts,
    onCreateContactLink,
    onRevokeContact,
    onIngestContactReturn,
  }) => (
    <ContactLinks
      contacts={contacts}
      nowDay={todayEpochDay()}
      onCreate={onCreateContactLink}
      onRevoke={onRevokeContact}
      onIngestReturn={onIngestContactReturn}
    />
  ),
};
