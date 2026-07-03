import { COPY, Section } from "./Privacy.parts.tsx";
import { NameCard } from "./Privacy.name.tsx";
import {
  RecoveryPassword,
  type RecoveryPasswordOps,
} from "../settings/RecoveryPassword.tsx";
import { RecoveryPhrase } from "../settings/RecoveryPhrase.tsx";

// Account: who you are and how you get back in. The display name (a device-local
// label that autosaves) and the password factor (doc 32), each shown only when its
// ops are wired. Public names moved to the Links tab (doc 17), managed there.
export interface AccountSectionProps {
  name: string | null;
  onSetName?: ((name: string | null) => void) | undefined;
  recoveryName: string | null | undefined;
  recoveryOps: RecoveryPasswordOps | undefined;
  /** The stored recovery phrase to re-view (doc 32). undefined hides the card
   * (logged-out preview); null shows the sign-in fallback; a string reveals behind
   * the gate. */
  recoveryPhrase?: string | null | undefined;
  /** Whether a passkey is enrolled on this device (doc 32): gates the phrase re-view
   * behind a passkey check when true. */
  passkeyEnrolled?: boolean | undefined;
  /** Run the passkey "confirm it's you" check before revealing the phrase (doc 32).
   * A pure presence gate; never touches the session. */
  onVerifyPasskey?: (() => Promise<boolean>) | undefined;
}

export function AccountSection({
  name,
  onSetName,
  recoveryName,
  recoveryOps,
  recoveryPhrase,
  passkeyEnrolled,
  onVerifyPasskey,
}: AccountSectionProps) {
  return (
    <Section title={COPY.accountTitle}>
      {onSetName && <NameCard name={name} onSave={onSetName} />}
      {recoveryOps && (
        <RecoveryPassword
          recoveryName={recoveryName ?? null}
          ops={recoveryOps}
        />
      )}
      {recoveryPhrase !== undefined && (
        <RecoveryPhrase
          phrase={recoveryPhrase}
          passkeyEnrolled={passkeyEnrolled ?? false}
          onVerifyPasskey={onVerifyPasskey}
        />
      )}
    </Section>
  );
}
