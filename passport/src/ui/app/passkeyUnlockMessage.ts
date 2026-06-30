import type { ResumeFailure } from "../../store/index.ts";

/**
 * The honest, voice-guide copy for why a passkey unlock did not get the owner in,
 * mapped from {@link ResumeFailure}. The point of this module is that "we couldn't
 * unlock" never collapses into the misleading "no passkey found": a locked or
 * cancelled prompt, a provider that can't do the secure unlock (some password
 * managers, including some 1Password builds), and a genuinely empty device each
 * say their own true thing, and every one points to the recovery phrase as the
 * always-available way back in.
 */
export function passkeyUnlockMessage(reason: ResumeFailure): string {
  switch (reason) {
    case "no-binding":
      return "No passkey is saved on this device yet. Use your recovery phrase to get back in.";
    case "no-prf":
      return "This passkey can’t do the secure unlock we need (some password managers can’t yet). Use your recovery phrase, or add a passkey from this device.";
    case "cancelled":
      return "The passkey prompt was cancelled or timed out. Try again, or use your recovery phrase.";
    case "mismatch":
      return "That passkey doesn’t match the account saved on this device. Use your recovery phrase.";
    case "no-account":
      return "We couldn’t find your account on this device. Use your recovery phrase to get back in.";
    case "unavailable":
      return "We couldn’t reach your passkey. Make sure it’s unlocked, then try again, or use your recovery phrase.";
  }
}
