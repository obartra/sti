// Admin invite share (doc 33, slice 7b): an admin creates a bearer invite link and
// hands it to someone they want in. The returned link rides entirely in its own
// fragment (nothing to the server), shown here in the same QR + copy card the share
// sheet uses. Below it, the invites already sent but not yet accepted, each with a
// one-tap cancel. Admin-only; the parent renders this only for group.isAdmin.
import { useState } from "react";
import { Button } from "../../design/components/index.ts";
import { UserPlus } from "../../design/icons.tsx";
import { UrlCard, urlStateOf, displayLink } from "../share/ShareSheet.url.tsx";
import { copyText } from "../../lib/clipboard.ts";
import type { GroupRecord } from "../../store/index.ts";
import { GROUPS_COPY as C } from "./groupsCopy.ts";
import "./groups.css";

// The created link, rendered in the reused share-sheet URL card (QR + copy + save).
// A real link is always "ready"; copy hands off the full https link.
function InviteLinkCard({ url }: { url: string }) {
  const state = urlStateOf(url, false);
  const { url: display, seed } = displayLink(url);
  return (
    <UrlCard
      state={state}
      url={display}
      seed={seed}
      onCopy={() => copyText(url)}
      onRetry={undefined}
    />
  );
}

// One waiting invite: its admin-only private label (or a neutral fallback) and a
// cancel that kills the link before it is accepted.
function PendingInviteRow({
  label,
  onRevoke,
}: {
  label: string;
  onRevoke: () => void;
}) {
  return (
    <div className="gr__admin-row">
      <div className="gr__admin-row-text">{label}</div>
      <Button variant="quiet" size="sm" onClick={onRevoke}>
        {C.revokeCta}
      </Button>
    </div>
  );
}

export interface GroupInviteShareProps {
  group: GroupRecord;
  /** Create an invite link for this group; resolves the shareable URL. */
  onCreateInvite: (groupId: string) => Promise<string>;
  /** Cancel a not-yet-accepted invite by id. */
  onRevokeInvite: (groupId: string, inviteId: string) => void;
}

export function GroupInviteShare({
  group,
  onCreateInvite,
  onRevokeInvite,
}: GroupInviteShareProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = group.pendingInvites ?? [];

  const create = () => {
    if (busy) return;
    setBusy(true);
    void onCreateInvite(group.groupId)
      .then((u) => setUrl(u))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  return (
    <div className="gr__admin">
      <div className="gr__sect-label">{C.inviteHeading}</div>
      <div className="gr__note">{C.inviteShareNote}</div>
      {url !== null && <InviteLinkCard url={url} />}
      <Button
        variant="secondary"
        size="md"
        block
        icon={<UserPlus size={16} />}
        disabled={busy}
        onClick={create}
      >
        {C.inviteCta}
      </Button>
      {pending.length > 0 && (
        <div>
          <div className="gr__sect-label">{C.pendingHeading}</div>
          <div className="gr__rows">
            {pending.map((p) => (
              <PendingInviteRow
                key={p.inviteId}
                label={
                  p.label !== undefined && p.label !== ""
                    ? p.label
                    : C.pendingHeading
                }
                onRevoke={() => onRevokeInvite(group.groupId, p.inviteId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
