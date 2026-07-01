import { COPY } from "./claimCopy.ts";

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
    <div style={{ textAlign: "center", marginTop: 2 }}>
      <button
        type="button"
        onClick={onSwitch}
        style={{
          padding: "6px 4px",
          background: "none",
          border: "none",
          cursor: "pointer",
          font: "inherit",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text-accent)",
        }}
      >
        {isLogin ? COPY.switchToCreate : COPY.switchToLogin}
      </button>
    </div>
  );
}
