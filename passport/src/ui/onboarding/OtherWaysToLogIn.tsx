import { useId, useState } from "react";
import { Button, Field, Input } from "../../design/components/index.ts";
import { Chevron } from "../../design/icons.tsx";
import { COPY } from "./claimCopy.ts";
import "./onboarding.css";

// The no-passkey ways back in, one per screen (never two forms at once): the
// login body shows a chooser of ways, and picking one swaps in that way's form.

// One row in the "other ways to log in" chooser: a quiet hairline-opened row
// with the way's name, a one-line explanation, and a forward chevron.
export function WayRow({
  title,
  sub,
  onPick,
}: {
  title: string;
  sub: string;
  onPick: () => void;
}) {
  return (
    <button type="button" className="onb__way" onClick={onPick}>
      <span className="onb__way-body">
        <span className="onb__way-title">{title}</span>
        <span className="onb__way-sub">{sub}</span>
      </span>
      <span className="onb__way-icon" aria-hidden="true">
        <Chevron size={18} />
      </span>
    </button>
  );
}

// Recovery-phrase entry: the high-entropy backstop for anyone with neither a
// passkey nor a password on this device. Just the field and a log-in button.
export function PhraseLogin({
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
    <div className="onb__form">
      <Field
        label={COPY.recoverLabel}
        hint={COPY.recoverHint}
        htmlFor={phraseId}
      >
        <Input
          id={phraseId}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Button
        variant="primary"
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
// failure, surfaced through the shared error line under the button.
export function PasswordLogin({
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
    <div className="onb__form">
      <Field label={COPY.recoverPwNameLabel} htmlFor={nameId}>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <Field label={COPY.recoverPwPasswordLabel} htmlFor={passwordId}>
        <Input
          id={passwordId}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Button
        variant="primary"
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
