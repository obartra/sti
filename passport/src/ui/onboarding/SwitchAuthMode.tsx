import { COPY } from "./claimCopy.ts";
import "./onboarding.css";

// The one-tap switch between log in and sign up, shown at the bottom of each
// variant so someone who opened the wrong one does not have to hunt: login shows
// "New here? Create an account," create shows "Already have an account? Log in."
export function SwitchAuthMode({
  isLogin,
  onSwitch,
}: {
  isLogin: boolean;
  onSwitch?: (() => void) | undefined;
}) {
  if (!onSwitch) return null;
  return (
    <div className="onb__switch">
      <button type="button" onClick={onSwitch} className="onb__switch-btn">
        {isLogin ? COPY.switchToCreate : COPY.switchToLogin}
      </button>
    </div>
  );
}
