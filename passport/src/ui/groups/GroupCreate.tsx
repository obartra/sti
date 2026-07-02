// Create a group (doc 33): name it, choose who can join and how often you meet,
// and read the one honest thing up front, that joining is sharing your color with
// everyone here and that a later positive tells everyone to test. On submit the
// group is created; a public name that is taken keeps the form so the owner can try
// another. Invite and join flows are a later slice; a fresh group starts with just
// you.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  Segmented,
} from "../../design/components/index.ts";
import { Lock, Users } from "../../design/icons.tsx";
import {
  normalizeVanityName,
  vanityNameError,
  type AliasIdentity,
  type CreateGroupInput,
  type CreateGroupResult,
  type GroupVisibility,
  type MeetingKind,
  type VanityNameError,
} from "../../store/index.ts";
import { GROUPS_COPY as C, disclosureFor } from "./groupsCopy.ts";
import { GroupFaceChoice } from "./GroupFaceChoice.tsx";

const NAME_ERROR: Record<VanityNameError, string> = {
  "too-short": C.handleTooShort,
  "too-long": C.handleTooLong,
  "bad-chars": C.handleBadChars,
  reserved: C.handleReserved,
};

type NameStatus = "idle" | "checking" | "free" | "taken" | "error";

// Live, as-you-type availability for a public handle: format-check synchronously,
// then a debounced non-claiming lookup, with a request counter so a fast typist
// never sees a stale answer land. Mirrors the Findable name field.
function useNameCheck(
  normalized: string,
  enabled: boolean,
  check: (name: string) => Promise<"free" | "taken" | "error">,
): NameStatus {
  const [status, setStatus] = useState<NameStatus>("idle");
  const reqId = useRef(0);
  useEffect(() => {
    if (!enabled || normalized === "" || vanityNameError(normalized) !== null) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const id = ++reqId.current;
    const timer = setTimeout(() => {
      void check(normalized).then((r) => {
        if (id === reqId.current) setStatus(r);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [normalized, enabled, check]);
  return status;
}

// One two-option control plus the note under the chosen option, so the choice and
// what it means read together (doc 21: outcome, not mechanism).
function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
  note,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  note: string;
}) {
  return (
    <Field label={label}>
      <Segmented
        options={options}
        value={value}
        onChange={onChange}
        aria-label={label}
      />
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-muted)",
          lineHeight: 1.5,
          marginTop: 8,
        }}
      >
        {note}
      </div>
    </Field>
  );
}

function StatusLine({
  formatError,
  status,
  claimError,
}: {
  formatError: string | null;
  status: NameStatus;
  claimError: string | null;
}) {
  const taken = status === "taken" || status === "error";
  const text =
    claimError ??
    formatError ??
    (status === "taken"
      ? C.handleTaken
      : status === "checking"
        ? C.handleChecking
        : status === "free"
          ? C.handleFree
          : null);
  if (text === null) return null;
  const isError = claimError !== null || formatError !== null || taken;
  return (
    <div
      style={{
        fontSize: 12.5,
        marginTop: -4,
        color: isError ? "var(--status-expired-fg)" : "var(--text-muted)",
      }}
    >
      {text}
    </div>
  );
}

// The join-time disclosure (doc 33): a calm Lock-style note. Says the three honest
// things, with the event-vs-recurring line selected by the chosen meeting kind.
function Disclosure({ meetingKind }: { meetingKind: MeetingKind }) {
  return (
    <Card variant="tint" style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Lock size={17} />
      </span>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-body)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span>{C.membershipIsSharing}</span>
        <span>{disclosureFor(meetingKind)}</span>
        <span style={{ color: "var(--text-muted)" }}>{C.leaveIsEasy}</span>
      </div>
    </Card>
  );
}

// Route a create outcome to the next step: open the new group, or surface why the
// public handle could not be claimed (the group still exists either way). Split out
// so the submit handler and GroupCreate stay within their ceilings.
function applyCreateResult(
  res: { result: CreateGroupResult; groupId: string },
  onCreated: (groupId: string) => void,
  fail: (message: string) => void,
): void {
  if (res.result === "created" || res.result === "registered") {
    onCreated(res.groupId);
  } else if (res.result === "unavailable") {
    fail(C.handleTaken);
  } else {
    fail(C.createError);
  }
}

// The group-name input and its live availability line. Split out so GroupCreate
// stays within its length/complexity ceilings; the error and status-visibility
// decisions live here rather than inline in the form.
function NameField({
  handle,
  busy,
  formatError,
  status,
  claimError,
  showStatus,
  onChange,
}: {
  handle: string;
  busy: boolean;
  formatError: string | null;
  status: NameStatus;
  claimError: string | null;
  // Only a public group checks availability; a private name is never "taken".
  showStatus: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Field label={C.handleLabel} hint={C.handleHint} htmlFor="group-handle">
        <Input
          id="group-handle"
          value={handle}
          error={formatError !== null || status === "taken"}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e.g. thursday_run"
          onChange={(ev) => onChange(ev.target.value)}
        />
      </Field>
      <StatusLine
        formatError={formatError}
        status={showStatus ? status : "idle"}
        claimError={claimError}
      />
    </div>
  );
}

export interface GroupCreateProps {
  onCreate: (
    input: CreateGroupInput,
  ) => Promise<{ result: CreateGroupResult; groupId: string }>;
  onCreated: (groupId: string) => void;
  onCheckName: (name: string) => Promise<"free" | "taken" | "error">;
  /** Whether the owner set a display name, so the "show as you" choice is offered
   * (with no name there is nothing to show and the group stays anonymous). */
  hasName?: boolean;
}

export function GroupCreate({
  onCreate,
  onCreated,
  onCheckName,
  hasName = false,
}: GroupCreateProps) {
  const [handle, setHandle] = useState("");
  const [visibility, setVisibility] = useState<GroupVisibility>("public");
  const [meetingKind, setMeetingKind] = useState<MeetingKind>("recurring");
  const [identity, setIdentity] = useState<AliasIdentity>("anonymous");
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const normalized = normalizeVanityName(handle);
  const bad = normalized === "" ? null : vanityNameError(normalized);
  const formatError = bad === null ? null : NAME_ERROR[bad];
  // Only a public handle is checked for availability; a private group's name is not
  // claimed in the directory, so it is never "taken".
  const status = useNameCheck(normalized, visibility === "public", onCheckName);

  const submit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (normalized === "" || bad !== null || busy) return;
      setClaimError(null);
      setBusy(true);
      void onCreate({ handle: normalized, visibility, meetingKind, identity })
        .then((res) => applyCreateResult(res, onCreated, setClaimError))
        .catch(() => setClaimError(C.genericError))
        .finally(() => setBusy(false));
    },
    [
      normalized,
      bad,
      busy,
      visibility,
      meetingKind,
      identity,
      onCreate,
      onCreated,
    ],
  );

  const blockSubmit =
    busy ||
    normalized === "" ||
    bad !== null ||
    (visibility === "public" && (status === "taken" || status === "checking"));

  return (
    <form
      onSubmit={submit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {C.createTitle}
      </h1>

      <NameField
        handle={handle}
        busy={busy}
        formatError={formatError}
        status={status}
        claimError={claimError}
        showStatus={visibility === "public"}
        onChange={(v) => {
          setHandle(v);
          setClaimError(null);
        }}
      />

      <OptionRow
        label={C.visLabel}
        options={[
          { value: "public", label: C.visPublicOpt },
          { value: "private", label: C.visPrivateOpt },
        ]}
        value={visibility}
        onChange={setVisibility}
        note={visibility === "public" ? C.visPublicNote : C.visPrivateNote}
      />

      <OptionRow
        label={C.kindLabel}
        options={[
          { value: "event", label: C.kindEventOpt },
          { value: "recurring", label: C.kindRecurringOpt },
        ]}
        value={meetingKind}
        onChange={setMeetingKind}
        note={meetingKind === "event" ? C.kindEventNote : C.kindRecurringNote}
      />

      <GroupFaceChoice
        value={identity}
        hasName={hasName}
        onChange={setIdentity}
      />

      <Disclosure meetingKind={meetingKind} />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        icon={<Users size={18} />}
        disabled={blockSubmit}
      >
        {C.createCta}
      </Button>
    </form>
  );
}
