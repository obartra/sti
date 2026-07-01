import { useCallback, useRef, useState } from "react";
import type {
  OwnerSession,
  SessionController,
  SharingMode,
  SignUpRecovery,
  SignUpRecoveryOutcome,
} from "../../store/index.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { passkeyUnlockMessage } from "./passkeyUnlockMessage.ts";

/**
 * The result of the b1 claim step. The account is created on the first successful
 * call (`created`), and `recoveryOutcome` reports the optional at-sign-up password
 * step: undefined when none was chosen, "set" when the password landed, or a failure
 * (`nameUnavailable` / `weakPassword` / `error`) the create screen shows inline so the
 * owner can pick another Username or skip. Either way the account exists, so the flow
 * still proceeds to the recovery-phrase step.
 */
export interface ClaimResult {
  readonly created: boolean;
  readonly recoveryOutcome?: SignUpRecoveryOutcome;
}

/**
 * The onboarding/login actions the b1-b3 screens drive, plus the cross-step
 * draft they share. The account is created for real at b1 (signUp), so the
 * recovery phrase shown at b2 is the genuine one; b3 saves the profile and binds
 * a passkey before entering. A passkey loss is never fatal: enrollment is
 * best-effort and the phrase remains the way back in.
 */
export interface OnboardingActions {
  /** The real recovery phrase to show at b2, set once signUp succeeds. */
  readonly recoveryPhrase: string | null;
  /** A request is in flight (disable the advancing control). */
  readonly busy: boolean;
  /** A user-facing error from the last action, or null. */
  readonly error: string | null;
  /**
   * b1: create the account, optionally setting a Username + password at sign-up
   * (doc 32). The account is created once; calling again after a failed optional
   * password step (e.g. a taken Username) retries just the password on the existing
   * account, so it never mints a second account. Returns the created flag plus the
   * optional password outcome for the create screen to react to.
   */
  claim(
    handle: string | undefined,
    avatar: AvatarConfig,
    recovery?: SignUpRecovery,
  ): Promise<ClaimResult>;
  /** b3: persist the profile, bind a passkey (best-effort), and enter. */
  finish(sharingMode: SharingMode): Promise<void>;
  /** Login variant: unlock this device's passkey. Returns true on success. */
  loginPasskey(): Promise<boolean>;
  /**
   * Login/recovery on any device: load the account from its recovery phrase.
   * Returns true on success (the only way back in with no passkey on this device).
   */
  recoverPhrase(phrase: string): Promise<boolean>;
  /**
   * Login on a new device with the recovery name + password (doc 32). Returns true
   * on success; a wrong name or password is one uniform failure.
   */
  recoverPassword(name: string, password: string): Promise<boolean>;
}

// The created account + chosen avatar + the recovery phrase, carried from b1 to
// b3 in memory only. The phrase is passed to enrollPasskey (which re-derives the
// wrap key, doc 24); it is NEVER persisted.
interface OnboardingDraft {
  session: OwnerSession;
  avatar: AvatarConfig;
  recoveryPhrase: string;
}

// The shared in-flight state the login/claim callbacks all guard on: a synchronous
// latch (so a double-click can't fire two attempts before `busy` re-renders) plus
// the busy/error setters. Passed as one object to keep hook signatures within the
// param cap.
interface Latch {
  inFlight: { current: boolean };
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
}

// The three no-passkey/passkey login callbacks, split out of useOnboarding so its
// body stays within the size ceiling. Each shares the latch with claim/finish, so
// only one account action runs at a time across the whole flow.
function useLoginActions(
  controller: SessionController,
  onSession: (session: OwnerSession) => void,
  latch: Latch,
) {
  const { inFlight, setBusy, setError } = latch;

  const loginPasskey = useCallback(async () => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await controller.resume();
      if (result.ok) {
        onSession(result.session);
        return true;
      }
      // Say what actually went wrong (locked, cancelled, can't-do-PRF, or truly
      // no passkey here) instead of always "no passkey found".
      setError(passkeyUnlockMessage(result.reason));
      return false;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }, [controller, onSession, inFlight, setBusy, setError]);

  // Shared login boilerplate for the no-passkey paths (phrase, password): the
  // in-flight latch + busy/error handling around an attempt that returns a session
  // or null. On null we show the caller's mismatch message; a throw is a transient
  // failure. Keeps recoverPhrase/recoverPassword to one line each.
  const runRecover = useCallback(
    async (
      load: () => Promise<OwnerSession | null>,
      mismatch: string,
    ): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const session = await load();
        if (session !== null) {
          onSession(session);
          return true;
        }
        setError(mismatch);
        return false;
      } catch {
        setError("Could not sign in right now. Please try again.");
        return false;
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [onSession, inFlight, setBusy, setError],
  );

  const recoverPhrase = useCallback(
    (phrase: string) =>
      runRecover(
        () => controller.recover(phrase.trim()),
        "That phrase doesn't match an account. Check it and try again.",
      ),
    [controller, runRecover],
  );

  const recoverPassword = useCallback(
    (name: string, password: string) =>
      runRecover(
        () => controller.recoverByPassword(name.trim(), password),
        "That recovery name and password didn't match. Check them and try again.",
      ),
    [controller, runRecover],
  );

  return { loginPasskey, recoverPhrase, recoverPassword };
}

// Retry the optional password on the ALREADY-created account (a prior submit made it,
// but its at-sign-up password step failed, e.g. a taken Username). Never mints a
// second account: it re-sets the password on the existing session via the phrase we
// still hold (the Settings path re-derives the root and reuses the shared wrap
// helper). wrongPhrase cannot happen (we hold the correct phrase), so it folds into
// the generic error, keeping the outcome one of the sign-up shapes.
async function retrySignUpPassword(
  controller: SessionController,
  existing: OnboardingDraft,
  recovery: SignUpRecovery,
): Promise<{ draft: OnboardingDraft; result: ClaimResult }> {
  const { session, outcome } = await controller.setRecoveryPassword(
    existing.session,
    {
      name: recovery.recoveryName,
      password: recovery.password,
      phrase: existing.recoveryPhrase,
    },
  );
  const recoveryOutcome: SignUpRecoveryOutcome =
    outcome === "wrongPhrase" ? "error" : outcome;
  return {
    draft: { ...existing, session },
    result: { created: true, recoveryOutcome },
  };
}

// First submit: create the account, wrapping the optional password on the spot (no
// phrase re-entry) when a Username + password was chosen (doc 32).
async function createAccountDraft(
  controller: SessionController,
  handle: string | undefined,
  avatar: AvatarConfig,
  recovery: SignUpRecovery | undefined,
): Promise<{ draft: OnboardingDraft; result: ClaimResult }> {
  const created = await controller.signUp(handle, recovery);
  return {
    draft: {
      session: created.session,
      avatar,
      recoveryPhrase: created.recoveryPhrase,
    },
    result: {
      created: true,
      ...(created.recoveryOutcome !== undefined
        ? { recoveryOutcome: created.recoveryOutcome }
        : {}),
    },
  };
}

export function useOnboarding(
  controller: SessionController,
  onSession: (session: OwnerSession) => void,
): OnboardingActions {
  // A ref, not state: it never drives a render, and finish must read the latest
  // value without a stale closure.
  const draft = useRef<OnboardingDraft | null>(null);
  // A synchronous in-flight latch: `busy` only blocks after a re-render, so a
  // rapid double-click could fire two account creations before it takes effect.
  const inFlight = useRef(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The claim core (no latch): create the account on the first call, or retry just the
  // password on the already-created one, updating the shared draft. Split out so the
  // latch-wrapped `claim` stays small.
  const runClaim = useCallback(
    async (
      handle: string | undefined,
      avatar: AvatarConfig,
      recovery: SignUpRecovery | undefined,
    ): Promise<ClaimResult> => {
      const existing = draft.current;
      if (existing !== null) {
        // A bare re-submit just advances; a Username re-submit retries the password.
        if (recovery === undefined) return { created: true };
        const retried = await retrySignUpPassword(
          controller,
          existing,
          recovery,
        );
        draft.current = retried.draft;
        return retried.result;
      }
      const made = await createAccountDraft(
        controller,
        handle,
        avatar,
        recovery,
      );
      draft.current = made.draft;
      setRecoveryPhrase(made.draft.recoveryPhrase);
      return made.result;
    },
    [controller],
  );

  const claim = useCallback(
    async (
      handle: string | undefined,
      avatar: AvatarConfig,
      recovery?: SignUpRecovery,
    ): Promise<ClaimResult> => {
      if (inFlight.current) return { created: false };
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        return await runClaim(handle, avatar, recovery);
      } catch {
        setError("Could not create your account. Please try again.");
        return { created: false };
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [runClaim],
  );

  const finish = useCallback(
    async (sharingMode: SharingMode) => {
      const current = draft.current;
      if (current === null || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const updated = await controller.setProfile(current.session, {
          avatar: current.avatar,
          sharingMode,
        });
        // Bind a passkey so reload can resume without the phrase. Best-effort:
        // a declined or unavailable passkey still enters (the phrase recovers).
        // enrollPasskey re-derives the wrap key from the phrase (doc 24), so pass
        // the in-memory phrase rather than the session's non-extractable root.
        try {
          await controller.enrollPasskey(
            current.recoveryPhrase,
            updated.blob.handle ?? "",
          );
        } catch {
          // keep going; the account is already created and phrase-recoverable.
        }
        onSession(updated);
      } catch {
        // The account exists (created at b1); only the profile write failed.
        setError("Could not finish setup. Please try again.");
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [controller, onSession],
  );

  const { loginPasskey, recoverPhrase, recoverPassword } = useLoginActions(
    controller,
    onSession,
    { inFlight, setBusy, setError },
  );

  return {
    recoveryPhrase,
    busy,
    error,
    claim,
    finish,
    loginPasskey,
    recoverPhrase,
    recoverPassword,
  };
}
