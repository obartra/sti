import { Button, Card } from "../../design/components/index.ts";
import { Fingerprint } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { KeepSignedInToggle } from "./KeepSignedInToggle.tsx";
import { OtherWaysToLogIn } from "./OtherWaysToLogIn.tsx";
import { SwitchAuthMode } from "./SwitchAuthMode.tsx";
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
  /** Login variant: sign in with a handle + password (doc 32). Present only when
   * recovery is enabled; absent hides the password sign-in option. */
  onRecoverPassword?: ((name: string, password: string) => void) | undefined;
  /** Login variant: "keep me signed in on this device" choice + setter (doc 24). */
  keepSignedIn?: boolean;
  onKeepSignedInChange?: (v: boolean) => void;
  /** Flip between the login and create variants (one tap either way). */
  onSwitchMode?: (() => void) | undefined;
}

// The passkey unlock, the one obvious action on the login variant. On create it
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

// The login variant's body: the passkey leads, the keep-signed-in choice stays
// always visible, then the shared error line, then the collapsed "other ways in"
// disclosure holding the phrase and handle + password paths.
function LoginBody({
  busy,
  error,
  onLogin,
  onRecover,
  onRecoverPassword,
  keepSignedIn,
  onKeepSignedInChange,
}: {
  busy: boolean;
  error: string | null;
  onLogin?: (() => void) | undefined;
  onRecover?: ((phrase: string) => void) | undefined;
  onRecoverPassword?: ((name: string, password: string) => void) | undefined;
  keepSignedIn: boolean;
  onKeepSignedInChange?: ((v: boolean) => void) | undefined;
}) {
  return (
    <>
      <PasskeyCard isLogin busy={busy} onLogin={onLogin} />
      <KeepSignedInToggle
        checked={keepSignedIn}
        onChange={onKeepSignedInChange}
      />
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
      <OtherWaysToLogIn
        busy={busy}
        onRecover={onRecover}
        onRecoverPassword={onRecoverPassword}
      />
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
  onSwitchMode,
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
      {isLogin ? (
        <LoginBody
          busy={busy}
          error={error}
          onLogin={onLogin}
          onRecover={onRecover}
          onRecoverPassword={onRecoverPassword}
          keepSignedIn={keepSignedIn}
          onKeepSignedInChange={onKeepSignedInChange}
        />
      ) : (
        <>
          <PasskeyCard isLogin={false} busy={busy} onLogin={onLogin} />
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
          <CreateFlow busy={busy} onClaim={onClaim} />
        </>
      )}
      <SwitchAuthMode isLogin={isLogin} onSwitch={onSwitchMode} />
    </div>
  );
}
