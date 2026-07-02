import { useId, useState } from "react";
import { Button, Field, Input } from "../../design/components/index.ts";
import { Chevron } from "../../design/icons.tsx";
import { COPY } from "./claimCopy.ts";
import { cx } from "../../lib/cx.ts";
import "./onboarding.css";

// Recovery-phrase entry: the high-entropy backstop for anyone with neither a
// passkey nor a password on this device. Just the field and a log-in button.
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
    <div className="onb__group">
      <Field label={COPY.recoverLabel} htmlFor={phraseId}>
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
    </div>
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
    <div className="onb__group">
      <Field label={COPY.recoverPwNameLabel} htmlFor={nameId}>
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
    </div>
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
    <div className="onb__disclosure">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="onb__disclose"
      >
        {COPY.otherWaysLabel}
        <span
          className={cx(
            "onb__disclose-icon",
            open && "onb__disclose-icon--open",
          )}
        >
          <Chevron size={18} />
        </span>
      </button>
      {open && (
        <div id={regionId} className="onb__disclosure">
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
