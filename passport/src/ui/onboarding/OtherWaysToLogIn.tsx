import { useId, useState, type ReactNode } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";
import { Chevron, Key } from "../../design/icons.tsx";
import { COPY } from "./claimCopy.ts";

// A card holding one no-passkey way back in: a titled header, a hint, and the
// entry fields below. The icon and title come from the caller so the two cards
// (recovery phrase, handle + password) read the same.
function RecoveryCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <Key size={18} />
        </span>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        {hint}
      </div>
      {children}
    </Card>
  );
}

// Recovery-phrase entry: the high-entropy backstop for anyone with neither a
// passkey nor a password on this device.
function RecoverFlow({
  busy,
  onRecover,
}: {
  busy: boolean;
  onRecover?: ((phrase: string) => void) | undefined;
}) {
  const [phrase, setPhrase] = useState("");
  const phraseId = useId();
  const ok = phrase.trim().length > 0;
  return (
    <RecoveryCard title={COPY.recoverLabel} hint={COPY.recoverHint}>
      <Field label={COPY.recoverPlaceholder} htmlFor={phraseId}>
        <Input
          id={phraseId}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Button
        variant="secondary"
        size="lg"
        block
        disabled={!ok || busy}
        onClick={() => onRecover?.(phrase.trim())}
      >
        {COPY.recoverCta}
      </Button>
    </RecoveryCard>
  );
}

// Handle + password entry (doc 32): the memorable, weaker, opt-in path. The typed
// handle is the login lookup key; a wrong handle or password is one uniform
// failure, surfaced through the shared error line above the disclosure.
function RecoverPasswordFlow({
  busy,
  onRecoverPassword,
}: {
  busy: boolean;
  onRecoverPassword: (name: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const nameId = useId();
  const passwordId = useId();
  const ok = name.trim().length > 0 && password.length > 0;
  return (
    <RecoveryCard title={COPY.recoverPwLabel} hint={COPY.recoverPwHint}>
      <Field
        label={COPY.recoverPwNameLabel}
        hint={COPY.recoverPwNameHint}
        htmlFor={nameId}
      >
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Field label={COPY.recoverPwPasswordLabel} htmlFor={passwordId}>
        <Input
          id={passwordId}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <Button
        variant="secondary"
        size="lg"
        block
        disabled={!ok || busy}
        onClick={() => onRecoverPassword(name.trim(), password)}
      >
        {COPY.recoverPwCta}
      </Button>
    </RecoveryCard>
  );
}

// The no-passkey ways back in, tucked behind a collapsed "Other ways to log in"
// disclosure so the common case is one obvious button. Expanding reveals the
// recovery phrase always, and the handle + password when recovery is enabled.
export function OtherWaysToLogIn({
  busy,
  onRecover,
  onRecoverPassword,
}: {
  busy: boolean;
  onRecover?: ((phrase: string) => void) | undefined;
  onRecoverPassword?: ((name: string, password: string) => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          font: "inherit",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text-body)",
        }}
      >
        {COPY.otherWaysLabel}
        <span
          style={{
            display: "inline-flex",
            color: "var(--text-subtle)",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 120ms ease",
          }}
        >
          <Chevron size={18} />
        </span>
      </button>
      {open && (
        <div
          id={regionId}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <RecoverFlow busy={busy} onRecover={onRecover} />
          {onRecoverPassword && (
            <RecoverPasswordFlow
              busy={busy}
              onRecoverPassword={onRecoverPassword}
            />
          )}
        </div>
      )}
    </div>
  );
}
