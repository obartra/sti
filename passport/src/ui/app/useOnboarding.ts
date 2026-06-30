import { useCallback, useRef, useState } from "react";
import type {
  OwnerSession,
  SessionController,
  SharingMode,
} from "../../store/index.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";

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
  /** b1: create the account. Returns true to advance to b2. */
  claim(handle: string | undefined, avatar: AvatarConfig): Promise<boolean>;
  /** b3: persist the profile, bind a passkey (best-effort), and enter. */
  finish(sharingMode: SharingMode): Promise<void>;
  /** Login variant: unlock this device's passkey. Returns true on success. */
  loginPasskey(): Promise<boolean>;
  /**
   * Login/recovery on any device: load the account from its recovery phrase.
   * Returns true on success (the only way back in with no passkey on this device).
   */
  recoverPhrase(phrase: string): Promise<boolean>;
}

// The created account + chosen avatar + the recovery phrase, carried from b1 to
// b3 in memory only. The phrase is passed to enrollPasskey (which re-derives the
// wrap key, doc 24); it is NEVER persisted.
interface OnboardingDraft {
  session: OwnerSession;
  avatar: AvatarConfig;
  recoveryPhrase: string;
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

  const claim = useCallback(
    async (handle: string | undefined, avatar: AvatarConfig) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await controller.signUp(handle);
        draft.current = {
          session: result.session,
          avatar,
          recoveryPhrase: result.recoveryPhrase,
        };
        setRecoveryPhrase(result.recoveryPhrase);
        return true;
      } catch {
        setError("Could not create your account. Please try again.");
        return false;
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [controller],
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

  const loginPasskey = useCallback(async () => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const session = await controller.resume();
      if (session !== null) {
        onSession(session);
        return true;
      }
      setError("No passkey found on this device. Recover with your phrase.");
      return false;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }, [controller, onSession]);

  const recoverPhrase = useCallback(
    async (phrase: string) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const session = await controller.recover(phrase.trim());
        if (session !== null) {
          onSession(session);
          return true;
        }
        setError(
          "That phrase doesn't match an account. Check it and try again.",
        );
        return false;
      } catch {
        setError("Could not recover right now. Please try again.");
        return false;
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [controller, onSession],
  );

  return {
    recoveryPhrase,
    busy,
    error,
    claim,
    finish,
    loginPasskey,
    recoverPhrase,
  };
}
