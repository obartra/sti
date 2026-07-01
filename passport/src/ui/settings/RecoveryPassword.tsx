import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";
import { Lock } from "../../design/icons.tsx";
import {
  normalizeVanityName,
  vanityNameError,
} from "../../store/vanityName.ts";
import type { SetRecoveryPasswordOutcome } from "../../store/recoveryOps.ts";

// The optional password factor (doc 32), managed from Settings. Turning it on takes
// a recovery name, a password (checked by the strength gate), and the recovery
// phrase (needed because the session root is non-extractable, doc 24, and to prove
// the phrase names this account). The transport is injected (RecoveryPasswordOps) so
// this renders in Storybook and tests without a server. Gated by the recovery launch
// flag at the call site; this component assumes it is allowed.

export interface RecoveryPasswordOps {
  /** Turn the password on (or change it): wrap the root under `password` and store
   * the envelope at `name`. Returns the outcome; never throws on the expected cases. */
  set: (input: {
    name: string;
    password: string;
    phrase: string;
  }) => Promise<SetRecoveryPasswordOutcome>;
  /** Turn the password off: drop the stored envelope and clear the recovery name. */
  disable: () => Promise<void>;
}

export interface RecoveryPasswordProps {
  /** The owner's current recovery name, or null when no password is set. */
  recoveryName: string | null;
  ops: RecoveryPasswordOps;
}

const COPY = {
  title: "Password",
  offLead:
    "Set a password to get back in on a new device without typing your recovery phrase.",
  // The honesty rule (doc 21/32): name the phrase as the real backstop and say plainly
  // that a password is weaker, without describing how it could be attacked.
  backstop:
    "Your recovery phrase is still the real key. A password is a handy backup, so pick one only you would think of.",
  nameLabel: "Username",
  nameHelp: "The name you sign in with, used with your password.",
  passwordLabel: "New password",
  confirmLabel: "Confirm password",
  phraseLabel: "Recovery phrase",
  phraseHelp: "Type it once to turn the password on.",
  turnOn: "Turn on password",
  saving: "Setting up…",
  mismatch: "The passwords don't match.",
  wrongPhrase: "That recovery phrase doesn't match this account.",
  nameUnavailable: "That username is taken. Try another one.",
  weak: "Pick a stronger password.",
  failed: "Couldn't set it up. Try again.",
  onLead: "Get back in on a new device with your username and password.",
  yourName: "Username",
  change: "Change password",
  turnOff: "Turn off password",
  turningOff: "Turning off…",
} as const;

const OUTCOME_ERROR: Record<
  Exclude<SetRecoveryPasswordOutcome, "set">,
  string
> = {
  wrongPhrase: COPY.wrongPhrase,
  nameUnavailable: COPY.nameUnavailable,
  weakPassword: COPY.weak,
  error: COPY.failed,
};

export function RecoveryPassword({ recoveryName, ops }: RecoveryPasswordProps) {
  const [changing, setChanging] = useState(false);
  if (recoveryName !== null && !changing) {
    return (
      <EnabledView
        name={recoveryName}
        ops={ops}
        onChange={() => setChanging(true)}
      />
    );
  }
  return (
    <SetupForm
      ops={ops}
      initialName={recoveryName ?? ""}
      onDone={() => setChanging(false)}
    />
  );
}

// Live, as-you-type strength feedback: the reason string when the password is too
// weak, or null when it passes (or the field is empty). The estimator loads via
// dynamic import so its zxcvbn bundle stays out of the app shell; a request counter
// drops stale answers so a fast typist never sees an earlier keystroke's result.
function usePasswordStrength(password: string): string | null {
  const [reason, setReason] = useState<string | null>(null);
  const reqId = useRef(0);
  useEffect(() => {
    if (password === "") {
      setReason(null);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(() => {
      void import("../../auth/passwordStrength.ts").then(
        ({ gradePassword }) => {
          if (id !== reqId.current) return;
          const grade = gradePassword(password);
          setReason(grade.ok ? null : grade.reason);
        },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [password]);
  return reason;
}

function Header({ lead }: { lead: string }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Lock size={18} />
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
          {lead}
        </div>
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  if (text === null) return null;
  return (
    <div style={{ fontSize: 12.5, color: "var(--status-expired-fg)" }}>
      {text}
    </div>
  );
}

// The current form values plus the submit-time error, kept in one hook so SetupForm
// stays under its size ceiling.
function useSetupState(initialName: string) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return {
    name,
    setName,
    password,
    setPassword,
    confirm,
    setConfirm,
    phrase,
    setPhrase,
    error,
    setError,
    busy,
    setBusy,
  };
}

function SetupForm({
  ops,
  initialName,
  onDone,
}: {
  ops: RecoveryPasswordOps;
  initialName: string;
  onDone: () => void;
}) {
  const s = useSetupState(initialName);
  const normalized = normalizeVanityName(s.name);
  const nameBad = normalized !== "" && vanityNameError(normalized) !== null;
  const weak = usePasswordStrength(s.password);
  const mismatch = s.confirm !== "" && s.confirm !== s.password;

  const blocked =
    s.busy ||
    normalized === "" ||
    nameBad ||
    s.password === "" ||
    weak !== null ||
    mismatch ||
    s.phrase === "";

  const submit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (blocked) return;
      s.setError(null);
      s.setBusy(true);
      void ops
        .set({ name: normalized, password: s.password, phrase: s.phrase })
        .then((outcome) => {
          if (outcome === "set") onDone();
          else s.setError(OUTCOME_ERROR[outcome]);
        })
        .catch(() => s.setError(COPY.failed))
        .finally(() => s.setBusy(false));
    },
    [blocked, normalized, ops, onDone, s],
  );

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Header lead={COPY.offLead} />
      <div
        style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        {COPY.backstop}
      </div>
      <SetupFields
        s={s}
        nameBad={nameBad}
        weak={weak}
        mismatch={mismatch}
        blocked={blocked}
        submit={submit}
      />
    </Card>
  );
}

// The setup form's fields, split out so SetupForm stays under its size ceiling.
function SetupFields({
  s,
  nameBad,
  weak,
  mismatch,
  blocked,
  submit,
}: {
  s: ReturnType<typeof useSetupState>;
  nameBad: boolean;
  weak: string | null;
  mismatch: boolean;
  blocked: boolean;
  submit: (e: React.SyntheticEvent) => void;
}) {
  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <Field
        label={COPY.nameLabel}
        htmlFor="recovery-name"
        hint={COPY.nameHelp}
      >
        <Input
          id="recovery-name"
          value={s.name}
          error={nameBad}
          disabled={s.busy}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e.g. robin"
          onChange={(e) => {
            s.setName(e.target.value);
            s.setError(null);
          }}
        />
      </Field>
      <Field label={COPY.passwordLabel} htmlFor="recovery-password">
        <Input
          id="recovery-password"
          type="password"
          value={s.password}
          error={weak !== null}
          disabled={s.busy}
          autoComplete="new-password"
          onChange={(e) => {
            s.setPassword(e.target.value);
            s.setError(null);
          }}
        />
      </Field>
      <ErrorLine text={s.password === "" ? null : weak} />
      <Field label={COPY.confirmLabel} htmlFor="recovery-confirm">
        <Input
          id="recovery-confirm"
          type="password"
          value={s.confirm}
          error={mismatch}
          disabled={s.busy}
          autoComplete="new-password"
          onChange={(e) => s.setConfirm(e.target.value)}
        />
      </Field>
      <ErrorLine text={mismatch ? COPY.mismatch : null} />
      <Field
        label={COPY.phraseLabel}
        htmlFor="recovery-phrase"
        hint={COPY.phraseHelp}
      >
        <Input
          id="recovery-phrase"
          value={s.phrase}
          disabled={s.busy}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => {
            s.setPhrase(e.target.value);
            s.setError(null);
          }}
        />
      </Field>
      <ErrorLine text={s.error} />
      <Button
        type="submit"
        variant="primary"
        size="md"
        block
        disabled={blocked}
      >
        {s.busy ? COPY.saving : COPY.turnOn}
      </Button>
    </form>
  );
}

function EnabledView({
  name,
  ops,
  onChange,
}: {
  name: string;
  ops: RecoveryPasswordOps;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disable = useCallback(() => {
    setBusy(true);
    setError(null);
    void ops
      .disable()
      .catch(() => setError(COPY.failed))
      .finally(() => setBusy(false));
  }, [ops]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Header lead={COPY.onLead} />
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {COPY.yourName}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: 17,
          fontWeight: 700,
          color: "var(--text-strong)",
          wordBreak: "break-all",
        }}
      >
        {name}
      </div>
      <ErrorLine text={error} />
      <div style={{ display: "flex", gap: 10 }}>
        <Button
          variant="secondary"
          size="md"
          disabled={busy}
          onClick={onChange}
        >
          {COPY.change}
        </Button>
        <Button variant="secondary" size="md" disabled={busy} onClick={disable}>
          {busy ? COPY.turningOff : COPY.turnOff}
        </Button>
      </div>
    </Card>
  );
}
