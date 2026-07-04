import { ContactLinks } from "../../connect/ContactLinks.tsx";
import { LiveLinks } from "../../core/Privacy.aliases.tsx";
import { PublicNames, type FindableOps } from "../../findable/FindableName.tsx";
import { ShareLinkGuide } from "../../findable/ShareLinkGuide.tsx";
import { avatarSrc } from "../../../lib/avatars.ts";
import { handleFromDisplayName } from "../../../store/displayName.ts";
import type { LinkShareContext } from "../../core/Privacy.aliases.share.tsx";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";
import "../../connect/connect.css";

// The per-contact link manager: mint a private link for one person with a chosen
// lifetime, list active links, rename, revoke (doc 13, doc 16). Shared by the
// Links tab and the `alias-share` sub-screen it pushes.
function contactManager(ctx: ScreenCtx) {
  const { nav, owner, contacts, onCreateContactLink, onRenameContact } = ctx;
  return (
    <ContactLinks
      contacts={contacts}
      onCreate={(label, identity, expiresAt) =>
        onCreateContactLink(label, identity, expiresAt)
      }
      onRename={onRenameContact}
      onRevoke={ctx.onRevokeContact}
      canShowName={owner.handle !== undefined && owner.handle !== ""}
      avatarSrc={avatarSrc(owner.avatar)}
      onEditAvatar={() => nav.go("avatar-edit")}
    />
  );
}

// The public-names manager (doc 17): up to five names people can look you up by,
// each backed by its own dedicated public alias. The claim/check/release transport
// is bound to the owner session a layer up. Rendered above the private links: it is
// the public front door, they are the per-person side doors.
function publicNames(ctx: ScreenCtx) {
  const ops: FindableOps = {
    register: ctx.onRegisterVanityName,
    check: ctx.onCheckVanityName,
    release: ctx.onReleaseVanityName,
  };
  return (
    <PublicNames
      names={ctx.vanityNames}
      ops={ops}
      // A name that is also the sign-in username (doc 32) is pinned: it cannot be
      // removed without turning the password off first.
      pinnedName={ctx.recoveryName}
      // Seed the first handle's default from the internal display name, reduced to
      // the handle shape (editable). The display name itself is never shared.
      suggestedName={handleFromDisplayName(ctx.owner.handle ?? "")}
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
      {publicNames(ctx)}
      {/* The share-your-link guide (docs 16, 17) once a public name exists, built
          from the first claimed name (the default "share as main publicly" link). */}
      {ctx.vanityNames[0] !== undefined && (
        <ShareLinkGuide handle={ctx.vanityNames[0]} />
      )}
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
