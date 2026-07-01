import { useState } from "react";
import { Card, Button, Input } from "../../design/components/index.ts";
import { Copy, Link as LinkIcon } from "../../design/icons.tsx";
import {
  IdentityChoiceRow,
  FaceOverrideRow,
} from "../share/ShareSheet.identity.tsx";
import type { AvatarConfig } from "../../lib/avatars.ts";
import type { AliasIdentity } from "../../store/index.ts";

// The accepter's per-link reveal choice (doc 15): stay anonymous (the default) or
// show their own name, with an optional per-link face when showing the name. The
// accepter picks this the same way an owner does on every other share surface.
export interface AcceptReveal {
  identity: AliasIdentity;
  avatarOverride: AvatarConfig | undefined;
}

// The return link the inviter must open to finish the two-way link (doc 13 path A).
// Same shape as the Connect "link ready" card: a mono URL + a copy button.
function ReturnLink({ handle, url }: { handle: string; url: string }) {
  const copy = () => {
    try {
      void navigator.clipboard.writeText(url).catch(() => undefined);
    } catch {
      // no clipboard available
    }
  };
  return (
    <Card
      variant="tint"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div
        style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}
      >
        Added. Send this link back to @{handle} so they can see you too.
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          color: "var(--text-strong)",
          wordBreak: "break-all",
        }}
      >
        {url.replace(/^https?:\/\//, "")}
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<Copy size={15} />}
        onClick={copy}
      >
        Copy link to send back
      </Button>
    </Card>
  );
}

// A logged-in viewer opening a RETURN link the person they invited sent back
// (doc 13 path A): opening it completes the two-way link, no paste. One tap
// finishes their side; there is nothing to send onward.
export function ConnectSection({
  handle,
  onConnect,
}: {
  handle: string;
  onConnect: () => void;
}) {
  const [done, setDone] = useState(false);
  const connect = () => {
    onConnect();
    setDone(true);
  };
  if (done) {
    return (
      <Card
        variant="tint"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}
        >
          Linked. You and @{handle} can see each other now.
        </div>
      </Card>
    );
  }
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <LinkIcon size={18} />
        </span>
        <span
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          Link both ways with @{handle}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-muted)",
        }}
      >
        They sent this link back so you can see each other&apos;s status.
      </p>
      <Button variant="primary" size="lg" block onClick={connect}>
        Connect
      </Button>
    </Card>
  );
}

// A logged-in viewer opening a contact invite: add the inviter as a two-way
// contact (doc 13 path A), then surface the return link to send back. The accepter
// can reveal their own name and pick a per-link face (doc 15); anonymous is the
// default, matching every other share surface. `accepterName` and `accepterAvatar`
// are the accepter's own account name + face (the fallback face, and whether there
// is a name to show), not the inviter's.
export function AcceptInviteSection({
  handle,
  accepterName,
  accepterAvatar,
  onAccept,
}: {
  handle: string;
  accepterName: string | undefined;
  accepterAvatar: AvatarConfig | undefined;
  onAccept: (label: string, reveal: AcceptReveal) => Promise<string>;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AliasIdentity>("anonymous");
  const [avatarOverride, setAvatarOverride] = useState<
    AvatarConfig | undefined
  >(undefined);

  const add = () => {
    if (busy) return;
    setBusy(true);
    void onAccept(label.trim(), { identity, avatarOverride })
      .then((url) => setReturnUrl(url))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  if (returnUrl !== null) return <ReturnLink handle={handle} url={returnUrl} />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <LinkIcon size={18} />
        </span>
        <span
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          Add @{handle} to your contacts
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-muted)",
        }}
      >
        You’ll see each other&apos;s status and can alert each other. They’re
        added once you send the link back.
      </p>
      <Input
        placeholder="A private nickname for them"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={64}
      />
      <IdentityChoiceRow
        choice={identity}
        hasName={accepterName !== undefined}
        onChange={setIdentity}
      />
      <FaceOverrideRow
        choice={identity}
        override={avatarOverride}
        fallback={accepterAvatar}
        onChange={setAvatarOverride}
      />
      <Button variant="primary" size="lg" block onClick={add}>
        {busy ? "Adding..." : "Add to contacts"}
      </Button>
    </Card>
  );
}
