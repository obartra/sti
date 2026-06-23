import { COPY, usePrivacyState } from "./Privacy.parts.tsx";
import { Avatar, Button, Card } from "../../design/components/index.ts";
import type { OwnerState } from "../../core/badge.ts";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";
import type { PushControls } from "../app/usePush.ts";
import { LiveLinks } from "./Privacy.aliases.tsx";
import {
  AttributesCard,
  ControlsCard,
  DangerZone,
} from "./Privacy.sections.tsx";

// A compact entry to the avatar editor with a live preview of the current avatar.
function AvatarCard({ src, onEdit }: { src: string; onEdit: () => void }) {
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar size="lg" src={src} alt="" />
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.avatarTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 3,
          }}
        >
          {COPY.avatarSub}
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onEdit}>
        {COPY.avatarEdit}
      </Button>
    </Card>
  );
}

export interface PrivacyProps {
  ownerState: OwnerState;
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  aliases?: AliasRecord[];
  contacts?: ContactRecord[];
  onRevokeAlias?: ((id: string) => void) | undefined;
  onRevokeContact?: ((id: string) => void) | undefined;
  push?: PushControls | undefined;
  onViewAs?: (() => void) | undefined;
  onDeleted?: (() => void) | undefined;
  /** Live preview src for the current avatar; with onEditAvatar, shows the editor entry. */
  avatarSrc?: string | undefined;
  onEditAvatar?: (() => void) | undefined;
}

const noop = (): void => undefined;

export function Privacy({
  ownerState,
  setOwnerState,
  aliases = [],
  contacts = [],
  onRevokeAlias = noop,
  onRevokeContact = noop,
  push,
  onViewAs,
  onDeleted,
  avatarSrc,
  onEditAvatar,
}: PrivacyProps) {
  const state = usePrivacyState(ownerState, setOwnerState);
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          width: "100%",
          maxWidth: 390,
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.title}
        </h1>

        {onEditAvatar && avatarSrc !== undefined && (
          <AvatarCard src={avatarSrc} onEdit={onEditAvatar} />
        )}

        {/* One unified list of every live link (public/casual aliases + contact
            links), each individually revocable. */}
        <LiveLinks
          aliases={aliases}
          contacts={contacts}
          onRevokeAlias={onRevokeAlias}
          onRevokeContact={onRevokeContact}
          onViewAs={onViewAs}
        />

        <AttributesCard state={state} />
        <ControlsCard state={state} push={push} />
        <DangerZone state={state} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
