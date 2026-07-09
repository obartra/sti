import type { ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import {
  Globe,
  Lock,
  Link as LinkIcon,
  Trash,
  Share as ShareIcon,
} from "../../design/icons.tsx";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";
import { contactInviteUrl, keyedAliasLinkUrl } from "../../store/index.ts";
import {
  useLinkShare,
  type LinkShareContext,
} from "./Privacy.aliases.share.tsx";
import { expiryLabel } from "../share/ShareSheet.lifetime.tsx";
import { nowMs } from "../../core/clock.ts";
import "../connect/connect.css";

// "Your links": one honest list of everything that can currently resolve to the
// owner's status, the public/casual aliases plus every per-contact link. Each row
// can be shared on its own (its own URL + QR) and revoked on its own; revoking is
// the single "cut it off" control. The per-link face (handle + avatar) is chosen in
// the share sheet at mint time (doc 15), not edited from this list.
export interface LiveLinksProps {
  aliases: AliasRecord[];
  contacts: ContactRecord[];
  onRevokeAlias: (id: string) => void;
  onRevokeContact: (id: string) => void;
  /** The owner's current badge context, so each link's share sheet previews the
   * same card a viewer resolves. Absent hides the per-link share action. */
  share?: LinkShareContext | undefined;
  desktop?: boolean | undefined;
}

// The full shareable URL for a per-contact link: the keyed alias plus the notify
// capability (when the link has an inbox), so the recipient can open it AND link
// back (doc 13 path A). A link minted before per-contact inboxes falls back to the
// plain keyed alias link (still opens to the owner's status).
function contactUrl(c: ContactRecord): string {
  return c.myInbox !== undefined
    ? contactInviteUrl(c.alias, c.myInbox)
    : keyedAliasLinkUrl(c.alias);
}

// A row's sub line with the link's remaining time appended, when it has an
// expiry. Only private links ever carry one (doc 16); the public-profile row
// never calls this, so the invariant is visible right here in the component.
function withExpiry(sub: string, expiresAt: number | null | undefined): string {
  const expiry = expiryLabel(expiresAt, nowMs());
  return expiry === null ? sub : `${sub} · ${expiry}`;
}

function LinkRow({
  icon,
  title,
  sub,
  onShare,
  onRevoke,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onShare?: (() => void) | undefined;
  onRevoke: () => void;
}) {
  return (
    <div className="cl__row">
      <span aria-hidden className="cl__row-icon">
        {icon}
      </span>
      <div className="cl__row-body">
        <div className="cl__row-title cl__row-title--clip">{title}</div>
        <div className="cl__row-sub">{sub}</div>
      </div>
      {onShare && (
        <Button
          variant="quiet"
          size="sm"
          aria-label={`Share ${title}`}
          icon={<ShareIcon size={15} />}
          onClick={onShare}
        >
          Share
        </Button>
      )}
      <Button
        variant="quiet"
        size="sm"
        aria-label={`Revoke ${title}`}
        icon={<Trash size={15} />}
        onClick={onRevoke}
      >
        Revoke
      </Button>
    </div>
  );
}

export function LiveLinks({
  aliases,
  contacts,
  onRevokeAlias,
  onRevokeContact,
  share,
  desktop = false,
}: LiveLinksProps) {
  const empty = aliases.length === 0 && contacts.length === 0;
  // One share sheet for the whole list (only one link is shared at a time); rows
  // just hand it the URL to open. Absent when no badge context was passed.
  const linkShare = useLinkShare(
    share ?? { state: "gray", labels: [], route: null },
    desktop,
  );
  const canShare = share !== undefined;
  return (
    <div className="cl">
      <div>
        <h2 className="cl__sect-title">Your links</h2>
        <p className="cl__sect-sub">
          Everything that can resolve to your status right now. Share any one
          again, or revoke it to cut it off, the old link stops working
          immediately.
        </p>
      </div>

      {empty ? (
        <div className="cl__empty">
          No links shared yet. Create one from the share sheet or Links.
        </div>
      ) : (
        <div className="cl__rows">
          {aliases.map((a) => (
            <LinkRow
              key={a.id}
              icon={a.isPublic ? <Globe size={18} /> : <Lock size={18} />}
              title={a.isPublic ? "Public profile" : "Casual link"}
              sub={
                a.isPublic
                  ? "Anyone with the link"
                  : withExpiry("Link-only, unlisted", a.expiresAt)
              }
              onShare={
                canShare
                  ? () => linkShare.open(keyedAliasLinkUrl(a))
                  : undefined
              }
              onRevoke={() => onRevokeAlias(a.id)}
            />
          ))}
          {contacts.map((c) => (
            <LinkRow
              key={c.id}
              icon={<LinkIcon size={18} />}
              title={c.label || "Unnamed link"}
              sub={withExpiry(
                c.theirStatusAlias !== undefined ? "Linked" : "Private link",
                c.expiresAt,
              )}
              onShare={
                canShare ? () => linkShare.open(contactUrl(c)) : undefined
              }
              onRevoke={() => onRevokeContact(c.id)}
            />
          ))}
        </div>
      )}
      {linkShare.sheet}
    </div>
  );
}
