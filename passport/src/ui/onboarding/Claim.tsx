import { Button, Card } from "../../design/components/index.ts";
import { Fingerprint } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { CreateFlow } from "./ClaimCreateFlow.tsx";
import { COPY, sectionLabel } from "./claimCopy.ts";

// B1 claim account. Faithful port of onboarding.jsx Claim + AvatarBuilder, copy
// verbatim from copy.js (claim). Passkey is the one MVP unlock path: no email,
// no phone, no SSO. The first alias is opaque + PRIVATE by default; vanity is an
// explicit, public-only opt-in (off by default).

export interface ClaimProps {
  /** When true, render the login (unlock) variant instead of the create flow. */
  isLogin?: boolean;
  onBack?: (() => void) | undefined;
  onContinue?: (() => void) | undefined;
  onEnter?: (() => void) | undefined;
}

export function Claim({
  isLogin = false,
  onBack,
  onContinue,
  onEnter,
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
          onClick={isLogin ? onEnter : undefined}
        >
          {isLogin ? COPY.usePasskeyLogin : COPY.usePasskey}
        </Button>
      </Card>
      {!isLogin && <CreateFlow onContinue={onContinue} />}
    </div>
  );
}
