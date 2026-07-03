import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Button,
  Field,
  IconButton,
  Input,
} from "../../design/components/index.ts";
import { Dice, ArrowRight, Chevron } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import "./onboarding.css";
import { randomAvatar } from "../../lib/avatars.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import type { SignUpRecovery } from "../../store/index.ts";
import type { ClaimResult } from "../app/useOnboarding.ts";
import {
  normalizeVanityName,
  vanityNameError,
} from "../../store/vanityName.ts";
import { COPY } from "./claimCopy.ts";
import { funName } from "./funName.ts";

// Only lowercase letters, digits, and underscore make a name (matches the handle
// shape the account accepts). Shared by typing and the shuffle button.
const sanitize = (raw: string) => raw.replace(/[^a-z0-9_]/gi, "").toLowerCase();

// The name field with a shuffle button that fills a short, playful name.
function NameField({
  value,
  error,
  onChange,
  onShuffle,
}: {
  value: string;
  error: string | undefined;
  onChange: (next: string) => void;
  onShuffle: () => void;
}) {
  const inputId = useId();
  return (
    <Field
      label={COPY.nameLabel}
      hint={COPY.nameHint}
      error={error}
      htmlFor={inputId}
    >
      <div className="onb__fieldrow">
        <div className="onb__fieldrow-grow">
          <Input
            id={inputId}
            value={value}
            onChange={(e) => onChange(sanitize(e.target.value))}
          />
        </div>
        <IconButton aria-label={COPY.shuffleLabel} onClick={onShuffle}>
          <Dice size={18} />
        </IconButton>
      </div>
    </Field>
  );
}

// Live, as-you-type password strength feedback: the reason string when the password
// is too weak, or null when it passes (or is empty). The estimator loads via dynamic
// import so its zxcvbn bundle stays out of the app shell; a request counter drops
// stale answers so a fast typist never sees an earlier keystroke's result. Mirrors
// the Settings card's hook (RecoveryPassword.tsx).
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

// A small red line under a field.
function ErrorLine({ text }: { text: string | null }) {
  if (text === null) return null;
  return <div className="onb__field-error">{text}</div>;
}

// The optional password state, kept in one hook so PasswordDisclosure stays small.
function usePasswordFields() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return { name, setName, password, setPassword, confirm, setConfirm };
}

type PasswordFields = ReturnType<typeof usePasswordFields>;

// Whether the owner has started filling the optional password (so an incomplete or
// invalid entry should block submit rather than being silently dropped). "Started"
// means either the Username or the password has any content.
function passwordStarted(fields: PasswordFields): boolean {
  return normalizeVanityName(fields.name) !== "" || fields.password !== "";
}

// The skippable "add a username and password" affordance (doc 32). Collapsed by
// default so the passkey/phrase path stays the uncluttered default; expanding reveals
// a Username (the public handle) and a password with the live strength gate. The
// taken-Username error is surfaced under the Username field from the last submit.
// The disclosure header: a chevron button that expands the optional password section.
function DisclosureToggle({
  open,
  regionId,
  onToggle,
}: {
  open: boolean;
  regionId: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={regionId}
      onClick={onToggle}
      className="onb__disclose"
    >
      {COPY.passwordDisclosure}
      <span
        className={cx("onb__disclose-icon", open && "onb__disclose-icon--open")}
      >
        <Chevron size={18} />
      </span>
    </button>
  );
}

// The revealed password section: the honest backstop note, the Username (public
// handle), and the password with its live strength gate and confirm.
function PasswordCard({
  fields,
  onNameChange,
  regionId,
  nameBad,
  weak,
  mismatch,
  nameTaken,
  disabled,
}: {
  fields: PasswordFields;
  onNameChange: (next: string) => void;
  regionId: string;
  nameBad: boolean;
  weak: string | null;
  mismatch: boolean;
  nameTaken: boolean;
  disabled: boolean;
}) {
  const nameId = useId();
  const pwId = useId();
  const confirmId = useId();
  return (
    <div id={regionId} className="onb__group">
      <div className="onb__group-note">{COPY.passwordBackstop}</div>
      <Field label={COPY.pwNameLabel} htmlFor={nameId} hint={COPY.pwNameHint}>
        <Input
          id={nameId}
          value={fields.name}
          error={nameBad || nameTaken}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e.g. robin"
          onChange={(e) => onNameChange(e.target.value)}
        />
      </Field>
      <ErrorLine
        text={nameBad ? COPY.pwNameBad : nameTaken ? COPY.pwNameTaken : null}
      />
      <Field label={COPY.pwPasswordLabel} htmlFor={pwId}>
        <Input
          id={pwId}
          type="password"
          value={fields.password}
          error={weak !== null}
          disabled={disabled}
          autoComplete="new-password"
          onChange={(e) => fields.setPassword(e.target.value)}
        />
      </Field>
      <ErrorLine text={fields.password === "" ? null : weak} />
      <Field label={COPY.pwConfirmLabel} htmlFor={confirmId}>
        <Input
          id={confirmId}
          type="password"
          value={fields.confirm}
          error={mismatch}
          disabled={disabled}
          autoComplete="new-password"
          onChange={(e) => fields.setConfirm(e.target.value)}
        />
      </Field>
      <ErrorLine text={mismatch ? COPY.pwMismatch : null} />
    </div>
  );
}

// The skippable "add a username and password" affordance (doc 32). Collapsed by
// default so the passkey/phrase path stays the uncluttered default.
function PasswordDisclosure(props: {
  fields: PasswordFields;
  onNameChange: (next: string) => void;
  open: boolean;
  onToggle: () => void;
  nameBad: boolean;
  weak: string | null;
  mismatch: boolean;
  nameTaken: boolean;
  disabled: boolean;
}) {
  const regionId = useId();
  const { open, onToggle, ...rest } = props;
  return (
    <div className="onb__disclosure">
      <DisclosureToggle open={open} regionId={regionId} onToggle={onToggle} />
      {open && <PasswordCard regionId={regionId} {...rest} />}
    </div>
  );
}

// The live validity signals for the optional password section, shared by the field
// errors and the submit gate (one source of truth). `pwBlocked` holds submit while a
// STARTED password is incomplete or invalid, so a typed-but-invalid password is never
// silently dropped; an untouched section never blocks (the passkey/phrase default).
function usePasswordSection(fields: PasswordFields): {
  nameBad: boolean;
  weak: string | null;
  mismatch: boolean;
  pwBlocked: boolean;
} {
  const normalized = normalizeVanityName(fields.name);
  const nameBad = normalized !== "" && vanityNameError(normalized) !== null;
  const weak = usePasswordStrength(fields.password);
  const mismatch = fields.confirm !== "" && fields.confirm !== fields.password;
  const pwBlocked =
    passwordStarted(fields) &&
    (readRecovery(fields) === undefined || weak !== null);
  return { nameBad, weak, mismatch, pwBlocked };
}

// Build the optional recovery payload from the password fields, or undefined when the
// owner left them blank (the skip / passkey-only default) or half-filled/invalid.
function readRecovery(
  fields: ReturnType<typeof usePasswordFields>,
): SignUpRecovery | undefined {
  const normalized = normalizeVanityName(fields.name);
  if (normalized === "" || fields.password === "") return undefined;
  if (vanityNameError(normalized) !== null) return undefined;
  if (fields.confirm !== fields.password) return undefined;
  return { recoveryName: normalized, password: fields.password };
}

// The create-account body. It collects the local name (optional, private) plus an
// optional Username + password to set at sign-up (doc 32), behind a disclosure so the
// default passkey/phrase path stays uncluttered. A fresh account gets a random avatar
// customized later from the dedicated editor (doc 19). Reach mode (Direct / Gated /
// Findable) is chosen later, at first-run setup (doc 16).
export function CreateFlow({
  busy = false,
  onClaim,
}: {
  busy?: boolean;
  onClaim?:
    | ((
        handle: string | undefined,
        avatar: AvatarConfig,
        recovery?: SignUpRecovery,
      ) => Promise<ClaimResult>)
    | undefined;
}) {
  const [name, setName] = useState("");
  const fields = usePasswordFields();
  const [open, setOpen] = useState(false);
  // A taken (or otherwise unstored) Username from the last submit; cleared as soon as
  // the owner edits the Username so the error never lingers past a fix.
  const [nameTaken, setNameTaken] = useState(false);
  const trimmed = name.trim();
  // Empty is allowed (name is optional); if something is typed it needs ≥3 chars.
  const ok = trimmed.length === 0 || trimmed.length >= 3;
  // Seed one random avatar per mount so every new account starts with a face.
  const [avatar] = useState<AvatarConfig>(() =>
    randomAvatar(Math.floor(Math.random() * 0x7fffffff)),
  );
  const { nameBad, weak, mismatch, pwBlocked } = usePasswordSection(fields);

  const setPwName = fields.setName;
  const onNameChange = useCallback(
    (next: string) => {
      setPwName(next);
      setNameTaken(false);
    },
    [setPwName],
  );

  const submit = useCallback(() => {
    if (onClaim === undefined) return;
    // A Username the server would not store for us keeps the owner here with a plain
    // inline error so they can pick another or clear it. The account is already made,
    // so the parent advances on any other outcome.
    void onClaim(trimmed || undefined, avatar, readRecovery(fields)).then(
      (result) => setNameTaken(result.recoveryOutcome === "nameUnavailable"),
    );
  }, [onClaim, trimmed, avatar, fields]);

  return (
    <>
      <NameField
        value={name}
        error={trimmed.length > 0 && !ok ? COPY.nameTooShort : undefined}
        onChange={setName}
        onShuffle={() => setName(sanitize(funName()))}
      />
      <PasswordDisclosure
        fields={fields}
        onNameChange={onNameChange}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        nameBad={nameBad}
        weak={weak}
        mismatch={mismatch}
        nameTaken={nameTaken}
        disabled={busy}
      />
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!ok || busy || pwBlocked}
        onClick={submit}
      >
        {COPY.cta} <ArrowRight size={18} />
      </Button>
    </>
  );
}
