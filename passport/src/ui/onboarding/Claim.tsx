import { Button } from "../../design/components/index.ts";
import { Fingerprint } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { KeepSignedInToggle } from "./KeepSignedInToggle.tsx";
import { OtherWaysToLogIn } from "./OtherWaysToLogIn.tsx";
import { SwitchAuthMode } from "./SwitchAuthMode.tsx";
import { CreateFlow } from "./ClaimCreateFlow.tsx";
import { COPY } from "./claimCopy.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import type { SignUpRecovery } from "../../store/index.ts";
import type { ClaimResult } from "../app/useOnboarding.ts";

// B1 claim account. Passkey is the one MVP unlock path: no email, no phone, no
// SSO. Each screen is a title plus its controls; the reach mode (Direct / Gated /
// Findable) is chosen later, at first-run setup (doc 16).

export interface ClaimProps {
  /** When true, render the login (unlock) variant instead of the create flow. */
  isLogin?: boolean;
  /** A sign-up / login request is in flight. */
  busy?: boolean;
  /** A user-facing error from the last attempt (sign-up or passkey login). */
  error?: string | null;
  onBack?: (() => void) | undefined;
  /**
   * Create variant: the chosen name (optional) + avatar, plus an optional Username +
   * password to set at sign-up (doc 32), on continue. Resolves with the claim result
   * so the create screen can show a taken-Username inline error and stay put, or let
   * the parent advance. Navigation to the phrase step is the parent's call.
   */
  onClaim?:
    | ((
        handle: string | undefined,
        avatar: AvatarConfig,
        recovery?: SignUpRecovery,
      ) => Promise<ClaimResult>)
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

// The shared error line above whichever body is showing.
function ErrorLine({ error }: { error: string | null }) {
  if (error === null) return null;
  return (
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
  );
}

// The step title, worded for whichever variant is showing.
function ClaimHeader({
  isLogin,
  onBack,
}: {
  isLogin: boolean;
  onBack?: (() => void) | undefined;
}) {
  return (
    <>
      <TopBack title="" onBack={onBack} />
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
    </>
  );
}

// The login variant's body: the passkey button leads, the keep-signed-in choice
// stays visible, then the shared error line, then the collapsed "other ways in"
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
      <KeepSignedInToggle
        checked={keepSignedIn}
        onChange={onKeepSignedInChange}
      />
      <ErrorLine error={error} />
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
          <ErrorLine error={error} />
          <CreateFlow busy={busy} onClaim={onClaim} />
        </>
      )}
      <SwitchAuthMode isLogin={isLogin} onSwitch={onSwitchMode} />
    </div>
  );
}
