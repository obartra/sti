import { useCallback, useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Key, Eye, EyeOff, Copy, Fingerprint } from "../../design/icons.tsx";
import { copyText } from "../../lib/clipboard.ts";

// Re-view the recovery phrase from Settings (doc 32). The phrase is the master key
// to the account, so revealing it sits behind a deliberate gate: a collapsed row by
// default, then a confirm step that warns the owner to check who can see the screen.
//
// When a passkey is enrolled on this device, that confirm step requires a passkey
// check (a biometric / "confirm it's you" prompt) before the phrase shows, since a
// real presence check is the right bar for the master key. The passkey check is a
// pure yes/no gate: it never re-unlocks or disturbs the live session. When no
// passkey is enrolled, the fallback is the plain two-step confirm ("Show it").
//
// Revealing does not persist the phrase anywhere new: it is already stored inside
// the encrypted account blob, and this only re-displays it. It re-collapses when the
// owner navigates away (the component unmounts), so it never lingers on screen.
//
// When the phrase is not stored on this device (an account that has only signed in
// with a passkey), there is nothing to show, so the card explains the phrase can be
// re-viewed after signing in with it once, rather than erroring.

export interface RecoveryPhraseProps {
  /** The stored phrase to re-display, or null when it is not on this device. */
  phrase: string | null;
  /** Whether a passkey is enrolled on this device. When true, revealing requires a
   * passkey check; when false (or omitted), the plain two-step confirm reveals. */
  passkeyEnrolled?: boolean;
  /** Run the passkey "confirm it's you" check; resolves true on success. Only
   * called when passkeyEnrolled is true. A pure presence gate: it never touches the
   * session. */
  onVerifyPasskey?: (() => Promise<boolean>) | undefined;
}

const COPY = {
  title: "Recovery phrase",
  lead: "See the phrase that gets you back in on a new device.",
  view: "View recovery phrase",
  // The gate copy: warn about surroundings and name what the phrase is, plainly,
  // without describing how it could be misused (doc 21 honesty rule).
  warn: "This is the key to your account. Make sure no one can see your screen before you show it.",
  reveal: "Show it",
  // The passkey-gated reveal action: a presence check stands in for the plain tap.
  confirm: "Confirm it's you",
  // A cancelled or failed passkey check: plain, non-alarmist, points back to retry.
  verifyFailed: "Couldn't confirm it was you. Try again.",
  cancel: "Not now",
  copy: "Copy",
  copied: "Copied",
  hide: "Hide",
  // The fallback when the phrase is not stored on this device.
  fallbackLead: "Your recovery phrase isn't saved on this device.",
  fallbackBody:
    "Sign in once with your phrase and you'll be able to see it here.",
} as const;

function CardTitle() {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Key size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-body)",
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          {COPY.lead}
        </div>
      </div>
    </div>
  );
}

// The mono block that shows the phrase once revealed, with copy and hide controls.
function RevealedPhrase({
  phrase,
  onHide,
}: {
  phrase: string;
  onHide: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!copyText(phrase)) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [phrase]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-lg)",
          padding: 14,
          boxShadow: "var(--shadow-sm)",
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.7,
          letterSpacing: "0.02em",
          color: "var(--text-strong)",
          wordBreak: "break-all",
        }}
      >
        {phrase}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy size={15} />}
          onClick={copy}
        >
          {copied ? COPY.copied : COPY.copy}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          icon={<EyeOff size={15} />}
          onClick={onHide}
        >
          {COPY.hide}
        </Button>
      </div>
    </div>
  );
}

// The confirm step: the surroundings warning plus the reveal action, so a single
// tap on the collapsed row never shows the phrase. When a passkey is enrolled, the
// reveal action runs a passkey check (a biometric / "confirm it's you" prompt) and
// only reveals on success; a cancelled or failed check keeps the phrase hidden and
// shows a plain retry line. Without a passkey, it is the plain "Show it" reveal.
function ConfirmGate({
  passkeyEnrolled,
  onVerify,
  onReveal,
  onCancel,
}: {
  passkeyEnrolled: boolean;
  onVerify: () => Promise<boolean>;
  onReveal: () => void;
  onCancel: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = useCallback(async () => {
    setFailed(false);
    setVerifying(true);
    let ok = false;
    try {
      ok = await onVerify();
    } finally {
      setVerifying(false);
    }
    // Reveal only on a confirmed presence check; a cancel / failure stays gated
    // with a plain, non-alarmist retry line (doc 21).
    if (ok) onReveal();
    else setFailed(true);
  }, [onVerify, onReveal]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.5 }}
      >
        {COPY.warn}
      </div>
      {failed && (
        <div
          style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.5 }}
        >
          {COPY.verifyFailed}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        {passkeyEnrolled ? (
          <Button
            variant="primary"
            size="md"
            icon={<Fingerprint size={16} />}
            onClick={() => void confirm()}
            disabled={verifying}
          >
            {COPY.confirm}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            icon={<Eye size={16} />}
            onClick={onReveal}
          >
            {COPY.reveal}
          </Button>
        )}
        <Button
          variant="quiet"
          size="md"
          onClick={onCancel}
          disabled={verifying}
        >
          {COPY.cancel}
        </Button>
      </div>
    </div>
  );
}

type Phase = "collapsed" | "confirm" | "revealed";

export function RecoveryPhrase({
  phrase,
  passkeyEnrolled = false,
  onVerifyPasskey,
}: RecoveryPhraseProps) {
  const [phase, setPhase] = useState<Phase>("collapsed");

  if (phrase === null) {
    return (
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <CardTitle />
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {COPY.fallbackLead} {COPY.fallbackBody}
        </div>
      </Card>
    );
  }

  // A passkey gate is only real when both the flag is set and a verify is wired.
  // A missing verify (mis-wiring) falls back to the plain two-step confirm rather
  // than an unreachable "Confirm it's you" button.
  const gated = passkeyEnrolled && onVerifyPasskey !== undefined;
  const verify = onVerifyPasskey ?? (() => Promise.resolve(true));

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <CardTitle />
      {phase === "collapsed" && (
        <Button
          variant="secondary"
          size="md"
          icon={<Eye size={16} />}
          onClick={() => setPhase("confirm")}
        >
          {COPY.view}
        </Button>
      )}
      {phase === "confirm" && (
        <ConfirmGate
          passkeyEnrolled={gated}
          onVerify={verify}
          onReveal={() => setPhase("revealed")}
          onCancel={() => setPhase("collapsed")}
        />
      )}
      {phase === "revealed" && (
        <RevealedPhrase phrase={phrase} onHide={() => setPhase("collapsed")} />
      )}
    </Card>
  );
}
