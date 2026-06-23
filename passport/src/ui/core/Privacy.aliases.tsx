import type { ReactNode } from "react";
import { Button, Card } from "../../design/components/index.ts";
import {
  Globe,
  Lock,
  Link as LinkIcon,
  Trash,
  Eye,
} from "../../design/icons.tsx";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";
import { nowMs, DAY_MS } from "../../core/clock.ts";

// "Your links": one honest list of everything that can currently resolve to the
// owner's status, the public/casual aliases plus every per-contact link, each
// individually revocable. The single "what's out there, cut it off" control. No
// per-alias handles/avatars or findable/vanity claims (the account has one handle
// and one avatar); those were a fixture, not the real model.
export interface LiveLinksProps {
  aliases: AliasRecord[];
  contacts: ContactRecord[];
  onRevokeAlias: (id: string) => void;
  onRevokeContact: (id: string) => void;
  onViewAs?: (() => void) | undefined;
}

function expiryLabel(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return "No expiry";
  const left = expiresAt - now;
  if (left <= 0) return "Expired";
  const days = Math.ceil(left / DAY_MS);
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function LinkRow({
  icon,
  title,
  sub,
  onRevoke,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
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
      <Button
        variant="quiet"
        size="sm"
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
  onViewAs,
}: LiveLinksProps) {
  const now = nowMs();
  const empty = aliases.length === 0 && contacts.length === 0;
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
          Everything that can resolve to your status right now. Revoke any one
          to cut it off, the old link stops working immediately.
        </p>
      </div>

      {onViewAs && (
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye size={15} />}
          onClick={onViewAs}
        >
          See what others see
        </Button>
      )}

      {empty ? (
        <Card
          variant="flat"
          style={{ fontSize: 13.5, color: "var(--text-muted)" }}
        >
          No links shared yet. Create one from the share sheet or Connect.
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
              onRevoke={() => onRevokeAlias(a.id)}
            />
          ))}
          {contacts.map((c) => (
            <LinkRow
              key={c.id}
              icon={<LinkIcon size={18} />}
              title={c.label || "Unnamed link"}
              sub={
                (c.theirStatusAlias !== undefined
                  ? "Linked both ways · "
                  : "") + expiryLabel(c.expiresAt, now)
              }
              onRevoke={() => onRevokeContact(c.id)}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
