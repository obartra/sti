import { ContactLinks } from "../../connect/ContactLinks.tsx";
import { LiveLinks } from "../../core/Privacy.aliases.tsx";
import { avatarSrc } from "../../../lib/avatars.ts";
import type { LinkShareContext } from "../../core/Privacy.aliases.share.tsx";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";
import "../../connect/connect.css";

// The per-contact link manager: mint a private link for one person, list active
// links, rename, revoke (doc 13). Each link is durable until revoked. Shared by the
// Links tab and the `alias-share` sub-screen it pushes.
function contactManager(ctx: ScreenCtx) {
  const { nav, owner, contacts, onCreateContactLink, onRenameContact } = ctx;
  return (
    <ContactLinks
      contacts={contacts}
      onCreate={(label, identity) => onCreateContactLink(label, identity)}
      onRename={onRenameContact}
      onRevoke={ctx.onRevokeContact}
      canShowName={owner.handle !== undefined && owner.handle !== ""}
      avatarSrc={avatarSrc(owner.avatar)}
      onEditAvatar={() => nav.go("avatar-edit")}
    />
  );
}

// The owner's current badge context, so each link in the list shares a sheet that
// previews the same card a viewer would resolve.
function shareContext(ctx: ScreenCtx): LinkShareContext {
  return {
    state: ctx.owner.viewerBadge,
    labels: ctx.owner.labels,
    route: ctx.owner.blueRoute,
    handle: ctx.owner.handle,
    avatarSrc: avatarSrc(ctx.owner.avatar),
  };
}

export const linksRenderers: ScreenRenderers = {
  // Links: every link you hand out, in one place. The manager mints and lists your
  // private links; below it, the live-links list shows everything that can resolve
  // to your status right now, each individually shareable and revocable (doc 31).
  links: (ctx) => (
    <div className="cn-screen">
      {contactManager(ctx)}
      <LiveLinks
        aliases={ctx.aliases}
        contacts={ctx.contacts}
        onRevokeAlias={ctx.onRevokeAlias}
        onRevokeContact={ctx.onRevokeContact}
        share={shareContext(ctx)}
      />
    </div>
  ),
  // The create/share sub-screen, still reachable on its own (e.g. the install
  // "Share" shortcut) as the per-contact link manager.
  "alias-share": (ctx) => contactManager(ctx),
};
