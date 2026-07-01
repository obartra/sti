import { useId, useState } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";
import { Fingerprint, Key } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { KeepSignedInToggle } from "./KeepSignedInToggle.tsx";
import { CreateFlow } from "./ClaimCreateFlow.tsx";
import { COPY, sectionLabel } from "./claimCopy.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";

// B1 claim account. Passkey is the one MVP unlock path: no email, no phone, no
// SSO. The handle + avatar are the owner's main identity (doc 15), the face they
// can choose to show; every link is anonymous by default. How a link is reached
// (Direct / Gated / Findable) is chosen later, at first-run setup (doc 16).

export interface ClaimProps {
  /** When true, render the login (unlock) variant instead of the create flow. */
  isLogin?: boolean;
  /** A sign-up / login request is in flight. */
  busy?: boolean;
  /** A user-facing error from the last attempt (sign-up or passkey login). */
  error?: string | null;
  onBack?: (() => void) | undefined;
  /** Create variant: the chosen handle (optional) + avatar, on continue. */
  onClaim?:
    | ((handle: string | undefined, avatar: AvatarConfig) => void)
    | undefined;
  /** Login variant: unlock with the device passkey. */
  onLogin?: (() => void) | undefined;
  /** Login variant: recover the account from its phrase (new device). */
  onRecover?: ((phrase: string) => void) | undefined;
  /** Login variant: sign in with a recovery name + password (doc 32). Present only
   * when recovery is enabled; absent hides the password sign-in option. */
  onRecoverPassword?: ((name: string, password: string) => void) | undefined;
  /** Login variant: "keep me signed in on this device" choice + setter (doc 24). */
  keepSignedIn?: boolean;
  onKeepSignedInChange?: (v: boolean) => void;
}

// Recovery-phrase entry: the no-passkey way back in on any device.
function RecoverFlow({
  busy,
  onRecover,
}: {
  busy: boolean;
  onRecover?: ((phrase: string) => void) | undefined;
}) {
  const [phrase, setPhrase] = useState("");
  const phraseId = useId();
  const ok = phrase.trim().length > 0;
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <Key size={18} />
        </span>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.recoverLabel}
        </div>
      </div>
      <div
        style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        {COPY.recoverHint}
      </div>
      <Field label={COPY.recoverPlaceholder} htmlFor={phraseId}>
        <Input
          id={phraseId}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Button
        variant="secondary"
        size="lg"
        block
        disabled={!ok || busy}
        onClick={() => onRecover?.(phrase.trim())}
      >
        {COPY.recoverCta}
      </Button>
    </Card>
  );
}

// Recovery name + password entry: the other no-passkey way back in (doc 32),
// shown only when recovery is enabled. A wrong name or password is one uniform
// failure, surfaced through the shared error line above.
function RecoverPasswordFlow({
  busy,
  onRecoverPassword,
}: {
  busy: boolean;
  onRecoverPassword: (name: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const nameId = useId();
  const passwordId = useId();
  const ok = name.trim().length > 0 && password.length > 0;
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <Key size={18} />
        </span>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.recoverPwLabel}
        </div>
      </div>
      <div
        style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        {COPY.recoverPwHint}
      </div>
      <Field label={COPY.recoverPwNameLabel} htmlFor={nameId}>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Field label={COPY.recoverPwPasswordLabel} htmlFor={passwordId}>
        <Input
          id={passwordId}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <Button
        variant="secondary"
        size="lg"
        block
        disabled={!ok || busy}
        onClick={() => onRecoverPassword(name.trim(), password)}
      >
        {COPY.recoverPwCta}
      </Button>
    </Card>
  );
}

// The account-key card. On login it carries the passkey unlock; on create it
// just explains the account key (the passkey is enrolled at the end of setup).
// Passkey / passphrase is the one MVP path: no email-or-phone field.
function PasskeyCard({
  isLogin,
  busy,
  onLogin,
}: {
  isLogin: boolean;
  busy: boolean;
  onLogin?: (() => void) | undefined;
}) {
  return (
    <Card
      variant="flat"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
        padding: "22px 20px",
      }}
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Fingerprint size={28} />
      </span>
      <div style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.5 }}>
        {COPY.passkeyHint}
      </div>
      {isLogin && (
        <Button
          variant="primary"
          size="lg"
          block
          icon={<Fingerprint size={18} />}
          disabled={busy}
          onClick={onLogin}
        >
          {COPY.usePasskeyLogin}
        </Button>
      )}
    </Card>
  );
}

// The step label + title + subtitle, worded for whichever variant is showing.
function ClaimHeader({
  isLogin,
  onBack,
}: {
  isLogin: boolean;
  onBack?: (() => void) | undefined;
}) {
  return (
    <>
      <TopBack title={isLogin ? COPY.loginStep : COPY.step} onBack={onBack} />
      <div>
        <h1
          style={{
            fontSize: 27,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {isLogin ? COPY.loginTitle : COPY.title}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-body)", marginTop: 6 }}>
          {isLogin ? COPY.loginSub : COPY.sub}
        </p>
      </div>
    </>
  );
}

// The no-passkey ways back in, shown together on the login variant: the recovery
// phrase always, and the recovery name + password when recovery is enabled.
function LoginRecovery({
  busy,
  onRecover,
  onRecoverPassword,
}: {
  busy: boolean;
  onRecover?: ((phrase: string) => void) | undefined;
  onRecoverPassword?: ((name: string, password: string) => void) | undefined;
}) {
  return (
    <>
      <RecoverFlow busy={busy} onRecover={onRecover} />
      {onRecoverPassword && (
        <RecoverPasswordFlow
          busy={busy}
          onRecoverPassword={onRecoverPassword}
        />
      )}
    </>
  );
}

export function Claim({
  isLogin = false,
  busy = false,
  error = null,
  onBack,
  onClaim,
  onLogin,
  onRecover,
  onRecoverPassword,
  keepSignedIn = true,
  onKeepSignedInChange,
}: ClaimProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <ClaimHeader isLogin={isLogin} onBack={onBack} />
      <div style={sectionLabel}>{COPY.keyLabel}</div>
      <PasskeyCard isLogin={isLogin} busy={busy} onLogin={onLogin} />
      {isLogin && (
        <KeepSignedInToggle
          checked={keepSignedIn}
          onChange={onKeepSignedInChange}
        />
      )}
      {error !== null && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--status-expired-fg)",
          }}
        >
          {error}
        </div>
      )}
      {isLogin && (
        <LoginRecovery
          busy={busy}
          onRecover={onRecover}
          onRecoverPassword={onRecoverPassword}
        />
      )}
      {!isLogin && <CreateFlow busy={busy} onClaim={onClaim} />}
    </div>
  );
}
