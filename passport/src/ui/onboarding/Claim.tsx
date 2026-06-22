import { useState } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";
import { Fingerprint, Key } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
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
  /** Create variant: the chosen handle + avatar, on continue. */
  onClaim?: ((handle: string, avatar: AvatarConfig) => void) | undefined;
  /** Login variant: unlock with the device passkey. */
  onLogin?: (() => void) | undefined;
  /** Login variant: recover the account from its phrase (new device). */
  onRecover?: ((phrase: string) => void) | undefined;
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
      <Field label={COPY.recoverPlaceholder}>
        <Input
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

export function Claim({
  isLogin = false,
  busy = false,
  error = null,
  onBack,
  onClaim,
  onLogin,
  onRecover,
}: ClaimProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
      }}
    >
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
      <div style={sectionLabel}>{COPY.keyLabel}</div>
      {/* Passkey / passphrase is the one MVP path. Phone-as-identity is banned
          and email/SSO is post-MVP, so there is no email-or-phone field. */}
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
        <div
          style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.5 }}
        >
          {COPY.passkeyHint}
        </div>
        <Button
          variant="primary"
          size="lg"
          block
          icon={<Fingerprint size={18} />}
          disabled={busy}
          onClick={isLogin ? onLogin : undefined}
        >
          {isLogin ? COPY.usePasskeyLogin : COPY.usePasskey}
        </Button>
      </Card>
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
      {isLogin && <RecoverFlow busy={busy} onRecover={onRecover} />}
      {!isLogin && <CreateFlow busy={busy} onClaim={onClaim} />}
    </div>
  );
}
