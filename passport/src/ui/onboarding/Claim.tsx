import { useState } from "react";
import { Button } from "../../design/components/index.ts";
import { Chevron, Fingerprint } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { KeepSignedInToggle } from "./KeepSignedInToggle.tsx";
import { PhraseLogin, PasswordLogin, WayRow } from "./OtherWaysToLogIn.tsx";
import { SwitchAuthMode } from "./SwitchAuthMode.tsx";
import { CreateFlow } from "./ClaimCreateFlow.tsx";
import { COPY } from "./claimCopy.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import type { SignUpRecovery } from "../../store/index.ts";
import type { ClaimResult } from "../app/useOnboarding.ts";
import "./onboarding.css";

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
    <div role="alert" className="onb__error">
      {error}
    </div>
  );
}

// The login stages, one way to log in per screen (never two forms at once):
// "main" leads with the passkey, "choose" lists the other ways, and "phrase" /
// "password" each show only that way's form. Back unwinds one stage at a time.
type LoginStage = "main" | "choose" | "phrase" | "password";

const STAGE_TITLE: Record<LoginStage, string> = {
  main: COPY.loginTitle,
  choose: COPY.otherWaysLabel,
  phrase: COPY.phraseStageTitle,
  password: COPY.passwordStageTitle,
};

// The step title, worded for whichever variant and login stage is showing.
function ClaimHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: (() => void) | undefined;
}) {
  return (
    <>
      <TopBack title="" onBack={onBack} />
      <h1 className="onb__title">{title}</h1>
    </>
  );
}

// The main login stage: the passkey button leads, the keep-signed-in choice
// stays visible, then the shared error line, then the forward row into the
// other ways.
function LoginMain({
  busy,
  error,
  onLogin,
  onOtherWays,
  keepSignedIn,
  onKeepSignedInChange,
}: {
  busy: boolean;
  error: string | null;
  onLogin?: (() => void) | undefined;
  onOtherWays: () => void;
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
      <button type="button" className="onb__disclose" onClick={onOtherWays}>
        {COPY.otherWaysLabel}
        <span className="onb__disclose-icon" aria-hidden="true">
          <Chevron size={18} />
        </span>
      </button>
    </>
  );
}

// The chooser stage: one quiet row per remaining way in. Picking one swaps in
// that way's form; nothing here logs in by itself.
function LoginChooser({
  onPick,
  hasPassword,
}: {
  onPick: (stage: LoginStage) => void;
  hasPassword: boolean;
}) {
  return (
    <div className="onb__ways">
      <WayRow
        title={COPY.wayPhraseTitle}
        sub={COPY.wayPhraseSub}
        onPick={() => onPick("phrase")}
      />
      {hasPassword && (
        <WayRow
          title={COPY.wayPasswordTitle}
          sub={COPY.wayPasswordSub}
          onPick={() => onPick("password")}
        />
      )}
    </div>
  );
}

// The login variant's body, staged. The keep-signed-in choice rides every stage
// that can actually log in (it applies to whichever way is used).
function LoginBody({
  stage,
  onStage,
  busy,
  error,
  onLogin,
  onRecover,
  onRecoverPassword,
  keepSignedIn,
  onKeepSignedInChange,
}: {
  stage: LoginStage;
  onStage: (stage: LoginStage) => void;
  busy: boolean;
  error: string | null;
  onLogin?: (() => void) | undefined;
  onRecover?: ((phrase: string) => void) | undefined;
  onRecoverPassword?: ((name: string, password: string) => void) | undefined;
  keepSignedIn: boolean;
  onKeepSignedInChange?: ((v: boolean) => void) | undefined;
}) {
  if (stage === "main") {
    return (
      <LoginMain
        busy={busy}
        error={error}
        onLogin={onLogin}
        // With no password path there is only one other way; skip the chooser.
        onOtherWays={() => onStage(onRecoverPassword ? "choose" : "phrase")}
        keepSignedIn={keepSignedIn}
        onKeepSignedInChange={onKeepSignedInChange}
      />
    );
  }
  if (stage === "choose") {
    return <LoginChooser onPick={onStage} hasPassword={!!onRecoverPassword} />;
  }
  return (
    <>
      {stage === "phrase" ? (
        <PhraseLogin busy={busy} onRecover={onRecover} />
      ) : (
        onRecoverPassword && (
          <PasswordLogin busy={busy} onRecoverPassword={onRecoverPassword} />
        )
      )}
      <ErrorLine error={error} />
      <KeepSignedInToggle
        checked={keepSignedIn}
        onChange={onKeepSignedInChange}
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
  const [stage, setStage] = useState<LoginStage>("main");
  // Back unwinds one login stage at a time; only the main stage leaves the
  // screen. A form stage returns to wherever it was entered from: the chooser
  // when a password path exists, else straight to main.
  const stageBack = (): void => {
    if (stage === "phrase" || stage === "password") {
      setStage(onRecoverPassword ? "choose" : "main");
    } else {
      setStage("main");
    }
  };
  const staged = isLogin && stage !== "main";
  return (
    <div className="onb">
      <ClaimHeader
        title={isLogin ? STAGE_TITLE[stage] : COPY.title}
        onBack={staged ? stageBack : onBack}
      />
      {isLogin ? (
        <LoginBody
          stage={stage}
          onStage={setStage}
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
      {/* The one-tap variant switch stays off the form stages, so a way's screen
          holds exactly that way. */}
      {!staged || stage === "choose" ? (
        <SwitchAuthMode isLogin={isLogin} onSwitch={onSwitchMode} />
      ) : null}
    </div>
  );
}
