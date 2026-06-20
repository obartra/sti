import { useState } from "react";
import { Button, Card, Avatar } from "../../design/components/index.ts";
import { Check, Lock, Link } from "../../design/icons.tsx";
import { Matrix } from "../../lib/qr.tsx";
import { avatarSrc, type AvatarConfigInput } from "../../lib/avatars.ts";

// ShareLink: show this alias's code for someone to scan, or copy the link. Both
// sides still confirm before a linkup binds. Faithful port of
// comps-reference/app/connect.jsx (the ShareLink component), copy verbatim from
// the connect object in copy.js. The privacy note and "Done" label are inline
// string literals in the source, kept inline here. No badge/status is surfaced.
const COPY = {
  shareTitle: "Share my link",
  shareSub:
    "Show this for someone to scan, or send the link. They confirm, you confirm, then you’re linked.",
  shareCopy: "Copy link",
  shareCopied: "Copied",
} as const;

// The shared-alias card: avatar + handle, the QR matrix, and the copyable URL.
function ShareCard({
  url,
  avatar,
}: {
  url: string;
  avatar: AvatarConfigInput;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Card
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: 22,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar
          initials="robin"
          alt="robin"
          src={avatarSrc(avatar)}
          size="md"
        />
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          @robin
        </span>
      </div>
      <div
        style={{
          padding: 14,
          background: "#fff",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Matrix size={188} seed="a7f3k9q2" hole={9} color="var(--ink-900)" />
      </div>
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--surface-sunken)",
          borderRadius: "var(--radius-pill)",
          padding: "0 6px 0 14px",
          height: 46,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--text-body)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {url}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? <Check size={15} /> : <Link size={15} />}
          onClick={() => {
            setCopied(true);
          }}
        >
          {copied ? COPY.shareCopied : COPY.shareCopy}
        </Button>
      </div>
    </Card>
  );
}

export interface ShareLinkProps {
  onDone?: (() => void) | undefined;
  /** Which alias is being shared. A public alias carries a key fragment in the URL. */
  sharingMode?: "private" | "public";
  /** Avatar for the shared alias (config or seed; defaults to seed 2). */
  avatar?: AvatarConfigInput;
}

export function ShareLink({
  onDone,
  sharingMode = "private",
  avatar = 2,
}: ShareLinkProps) {
  // Default to the private/main alias; its URL carries NO key (handed at link
  // time). A public alias would carry #k=…, see Privacy → aliases.
  const isPublic = sharingMode === "public";
  const url = isPublic ? "sti.care/a/a7f3k9q2#k=Zr8" : "sti.care/a/a7f3k9q2";
  return (
    <div style={{ width: "100%", maxWidth: 390 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          paddingTop: 4,
        }}
      >
        <h1
          style={{
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.shareTitle}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-body)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {COPY.shareSub}
        </p>

        <ShareCard url={url} avatar={avatar} />

        <Card variant="tint" style={{ display: "flex", gap: 11 }}>
          <span
            style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
          >
            <Lock size={17} />
          </span>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--text-body)",
            }}
          >
            {isPublic
              ? "Anyone you send this link to can see your status."
              : "Only the people you send this to can open it. Nobody else can find it."}
          </div>
        </Card>

        <Button variant="ghost" size="md" block onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
