import type { ReactNode } from "react";
import { Button, Card } from "../../design/components/index.ts";
import {
  Globe,
  Lock,
  Link as LinkIcon,
  Trash,
  Share as ShareIcon,
} from "../../design/icons.tsx";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";
import {
  aliasLinkUrl,
  contactInviteUrl,
  keyedAliasLinkUrl,
} from "../../store/index.ts";
import {
  useLinkShare,
  type LinkShareContext,
} from "./Privacy.aliases.share.tsx";

// "Your links": one honest list of everything that can currently resolve to the
// owner's status, the public/casual aliases plus every per-contact link. Each row
// can be shared on its own (its own URL + QR) and revoked on its own; revoking is
// the single "cut it off" control. No per-alias handles/avatars or findable/vanity
// claims (the account has one handle and one avatar).
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "10px 10px",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 34,
          height: 34,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{sub}</div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "var(--text-strong)",
            margin: 0,
          }}
        >
          Your links
        </h2>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "var(--text-muted)",
            marginTop: 4,
          }}
        >
          Everything that can resolve to your status right now. Share any one
          again, or revoke it to cut it off, the old link stops working
          immediately.
        </p>
      </div>

      {empty ? (
        <Card
          variant="flat"
          style={{ fontSize: 13.5, color: "var(--text-muted)" }}
        >
          No links shared yet. Create one from the share sheet or Links.
        </Card>
      ) : (
        <Card
          variant="flat"
          style={{ padding: 6, display: "flex", flexDirection: "column" }}
        >
          {aliases.map((a) => (
            <LinkRow
              key={a.id}
              icon={a.isPublic ? <Globe size={18} /> : <Lock size={18} />}
              title={a.isPublic ? "Public profile" : "Casual link"}
              sub={a.isPublic ? "Anyone with the link" : "Link-only, unlisted"}
              onShare={
                canShare ? () => linkShare.open(aliasLinkUrl(a)) : undefined
              }
              onRevoke={() => onRevokeAlias(a.id)}
            />
          ))}
          {contacts.map((c) => (
            <LinkRow
              key={c.id}
              icon={<LinkIcon size={18} />}
              title={c.label || "Unnamed link"}
              sub={
                c.theirStatusAlias !== undefined
                  ? "Linked both ways"
                  : "Private link"
              }
              onShare={
                canShare ? () => linkShare.open(contactUrl(c)) : undefined
              }
              onRevoke={() => onRevokeContact(c.id)}
            />
          ))}
        </Card>
      )}
      {linkShare.sheet}
    </div>
  );
}
