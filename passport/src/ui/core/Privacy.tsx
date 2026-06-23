import { COPY, usePrivacyState } from "./Privacy.parts.tsx";
import type { OwnerState } from "../../core/badge.ts";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";
import type { PushControls } from "../app/usePush.ts";
import { LiveLinks } from "./Privacy.aliases.tsx";
import {
  AttributesCard,
  ControlsCard,
  DangerZone,
} from "./Privacy.sections.tsx";

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
