import { ContactLinks } from "../../connect/ContactLinks.tsx";
import { LiveLinks } from "../../core/Privacy.aliases.tsx";
import { nowMs } from "../../../core/clock.ts";
import { avatarSrc } from "../../../lib/avatars.ts";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";

// The per-contact link manager: mint a private link for one person, list active
// links, rename, revoke, set a lifetime (doc 13). Shared by the Links tab and the
// `alias-share` sub-screen it pushes.
function contactManager(ctx: ScreenCtx) {
  const {
    nav,
    owner,
    contacts,
    onCreateContactLink,
    onRenameContact,
    onRevokeContact,
    onSetContactDuration,
    onIngestContactReturn,
  } = ctx;
  return (
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
  );
}

export const linksRenderers: ScreenRenderers = {
  // Links: every link you hand out, in one place. The manager mints and lists your
  // private links; below it, the live-links list shows everything that can resolve
  // to your status right now, each revocable (doc 31, absorbs the old Privacy list).
  links: (ctx) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {contactManager(ctx)}
      <LiveLinks
        aliases={ctx.aliases}
        contacts={ctx.contacts}
        onRevokeAlias={ctx.onRevokeAlias}
        onRevokeContact={ctx.onRevokeContact}
        onViewAs={() => ctx.nav.go("a2-public", { self: true })}
      />
    </div>
  ),
  // The create/share sub-screen, still reachable on its own (e.g. the install
  // "Share" shortcut) as the per-contact link manager.
  "alias-share": (ctx) => contactManager(ctx),
};
