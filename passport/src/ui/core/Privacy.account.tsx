import { COPY, Section } from "./Privacy.parts.tsx";
import { NameCard } from "./Privacy.name.tsx";
import { FindableName, type FindableOps } from "../findable/FindableName.tsx";
import { ShareLinkGuide } from "../findable/ShareLinkGuide.tsx";
import {
  RecoveryPassword,
  type RecoveryPasswordOps,
} from "../settings/RecoveryPassword.tsx";

// Account: who you are and how you get back in. The display name (a device-local
// label that autosaves), the public name (claim/manage the public handle, doc 17),
// and the password factor (doc 32), each shown only when its ops are wired.
export interface AccountSectionProps {
  name: string | null;
  onSetName?: ((name: string | null) => void) | undefined;
  vanityName: string | null | undefined;
  findableOps: FindableOps | undefined;
  recoveryName: string | null | undefined;
  recoveryOps: RecoveryPasswordOps | undefined;
}

export function AccountSection({
  name,
  onSetName,
  vanityName,
  findableOps,
  recoveryName,
  recoveryOps,
}: AccountSectionProps) {
  const held = vanityName ?? null;
  return (
    <Section title={COPY.accountTitle}>
      {onSetName && <NameCard name={name} onSave={onSetName} />}
      {findableOps && (
        <>
          <FindableName currentName={held} ops={findableOps} />
          {held !== null && held !== "" && <ShareLinkGuide handle={held} />}
        </>
      )}
      {recoveryOps && (
        <RecoveryPassword
          recoveryName={recoveryName ?? null}
          ops={recoveryOps}
        />
      )}
    </Section>
  );
}
