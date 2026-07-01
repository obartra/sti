import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";
import { Globe, Lock } from "../../design/icons.tsx";
import {
  normalizeVanityName,
  vanityNameError,
  type VanityNameError,
} from "../../store/vanityName.ts";
import type { VanityRegisterResult } from "../../api/client.ts";

// Findable owner registration (doc 17, F5). Lets the owner claim a public vanity
// name for their alias, behind an explicit consent disclosure. The transport is
// injected (FindableOps) so this is driven in tests/Storybook without a server,
// and so the parent can bind it to the right alias + persist the chosen name.

export interface FindableOps {
  /** Claim `name` for the owner's alias. Returns the outcome, never throws on the
   * expected "unavailable" (taken/reserved/blocked) case. */
  register: (name: string) => Promise<VanityRegisterResult>;
  /** Look up if `name` is free, without claiming it, so the form can answer as the
   * owner types. `name` is already normalized + format-valid. */
  check: (name: string) => Promise<"free" | "taken" | "error">;
  /** Release the currently registered name into the 24h lock. */
  release: () => Promise<void>;
}

export interface FindableNameProps {
  /** The owner's currently registered name, or null if none. */
  currentName: string | null;
  ops: FindableOps;
  /** Persist the result: the new name on a claim, or null on release. */
  onChange?: (name: string | null) => void;
  /** True when this name is the owner's sign-in username (a password is set on it,
   * doc 32): the name is pinned, so the release control is hidden and a plain reason
   * is shown. The server enforces the same rule (doc 17); this is the matching UI. */
  pinned?: boolean;
}

const NAME_ERROR: Record<VanityNameError, string> = {
  "too-short": "Use at least 3 characters.",
  "too-long": "Use at most 30 characters.",
  "bad-chars": "Lowercase letters, numbers, and _ only.",
  reserved: "That name is reserved.",
};

const COPY = {
  title: "Public name",
  lead: "Your name becomes public and searchable.",
  // The consent disclosure (doc 17 launch-gate item 5): being findable means people
  // can see you're here. Always-visible, never behind the expander. This is honest
  // consent for an opt-in public feature, not a leaked attack surface.
  harvest:
    "A public name is listed openly, so anyone can see you have a passport here. That's the trade for being findable.",
  sub: "Your status itself stays private. People still ask to see it, and you still approve.",
  details: "What else this means",
  bullets: [
    "Release the name and, after a short delay, anyone can claim it.",
    "Names aren't verified; someone may pick one close to yours.",
  ],
  label: "Choose a name",
  checking: "Checking…",
  available: "That name is free.",
  claim: "Make my name public",
  claiming: "Claiming…",
  // The server answers "unavailable" for any name you can't have: already taken,
  // reserved, or blocked. "Taken" was only true for one of those, so say the thing
  // that covers them all. "Available" reads at a normal level and stays honest.
  unavailable: "That name isn't available. Try another.",
  failed: "Couldn't reach the service. Try again.",
  registeredAt: "People can find you at this name:",
  release: "Release name",
  releasing: "Releasing…",
  // Shown in place of the release control when the name is the owner's sign-in
  // username (doc 32): releasing it would break the password login, so we point at
  // the fix instead of a dead end. Matches the server's refusal reason.
  pinned:
    "This name is your sign-in username. Turn the password off first to release it.",
} as const;

export function FindableName({
  currentName,
  ops,
  onChange,
  pinned = false,
}: FindableNameProps) {
  if (currentName !== null) {
    return (
      <RegisteredView
        name={currentName}
        ops={ops}
        onReleased={() => onChange?.(null)}
        pinned={pinned}
      />
    );
  }
  return <RegisterForm ops={ops} onRegistered={(n) => onChange?.(n)} />;
}

type NameStatus = "idle" | "checking" | "free" | "taken" | "error";

// Live, as-you-type availability: format-check synchronously, then a debounced
// non-claiming lookup. A request counter drops stale responses so a fast typist
// never sees an earlier keystroke's answer land over a later one.
function useNameCheck(
  normalized: string,
  check: FindableOps["check"],
): NameStatus {
  const [status, setStatus] = useState<NameStatus>("idle");
  const reqId = useRef(0);
  useEffect(() => {
    if (normalized === "" || vanityNameError(normalized) !== null) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const id = ++reqId.current;
    const timer = setTimeout(() => {
      void check(normalized).then((r) => {
        if (id === reqId.current) setStatus(r === "free" ? "free" : r);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [normalized, check]);
  return status;
}

// The live status line under the field: a format problem (red), then the debounced
// availability (red for taken, muted for checking/free). The submit-time claim
// error, when set, wins over all of it.
function StatusLine({
  formatError,
  status,
  claimError,
}: {
  formatError: string | null;
  status: NameStatus;
  claimError: string | null;
}) {
  const taken = status === "taken";
  const text =
    claimError ??
    formatError ??
    (taken
      ? COPY.unavailable
      : status === "checking"
        ? COPY.checking
        : status === "free"
          ? COPY.available
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

function RegisterForm({
  ops,
  onRegistered,
}: {
  ops: FindableOps;
  onRegistered: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const normalized = normalizeVanityName(name);
  const bad = normalized === "" ? null : vanityNameError(normalized);
  const formatError = bad === null ? null : NAME_ERROR[bad];
  const status = useNameCheck(normalized, ops.check);

  const submit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (normalized === "" || bad !== null) return;
      setClaimError(null);
      setBusy(true);
      void ops
        .register(normalized)
        .then((result) => {
          if (result === "registered") onRegistered(normalized);
          else if (result === "unavailable") setClaimError(COPY.unavailable);
          else setClaimError(COPY.failed);
        })
        .catch(() => setClaimError(COPY.failed))
        .finally(() => setBusy(false));
    },
    [normalized, bad, ops, onRegistered],
  );

  const blockSubmit =
    busy || normalized === "" || bad !== null || status === "taken";

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Consent />
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <Field label={COPY.label} htmlFor="vanity-name">
          <Input
            id="vanity-name"
            value={name}
            error={formatError !== null || status === "taken"}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. robin"
            onChange={(e) => {
              setName(e.target.value);
              setClaimError(null);
            }}
          />
        </Field>
        <StatusLine
          formatError={formatError}
          status={status}
          claimError={claimError}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          block
          disabled={blockSubmit}
        >
          {busy ? COPY.claiming : COPY.claim}
        </Button>
      </form>
    </Card>
  );
}

function RegisteredView({
  name,
  ops,
  onReleased,
  pinned,
}: {
  name: string;
  ops: FindableOps;
  onReleased: () => void;
  pinned: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const release = useCallback(() => {
    setBusy(true);
    setError(null);
    void ops
      .release()
      .then(onReleased)
      // The server enforces the pin too (doc 17): if a password was set on this name
      // (e.g. in another tab) after we rendered, it refuses with a 409. Surface the
      // plain reason rather than a generic failure.
      .catch((e: unknown) =>
        setError(isPinRefusal(e) ? COPY.pinned : COPY.failed),
      )
      .finally(() => setBusy(false));
  }, [ops, onReleased]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <Globe size={18} />
        </span>
        <div
          style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {COPY.registeredAt}
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
      {error !== null && (
        <div style={{ fontSize: 12.5, color: "var(--status-expired-fg)" }}>
          {error}
        </div>
      )}
      {/* Pinned (doc 32): this name is the sign-in username, so we do not offer to
          release it. Show the fix instead of a control that would be refused. */}
      {pinned ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {COPY.pinned}
        </div>
      ) : (
        <Button variant="secondary" size="md" disabled={busy} onClick={release}>
          {busy ? COPY.releasing : COPY.release}
        </Button>
      )}
    </Card>
  );
}

// A release the server refused because the name carries a password login (doc 17
// pin): the DELETE answers 409, which the api client surfaces as a "conflict" kind.
function isPinRefusal(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "kind" in e &&
    (e as { kind?: unknown }).kind === "conflict"
  );
}

// The consent disclosure (doc 17): one honest line up front, the specifics behind
// a native <details> expander so the reader can open them but isn't walled by them.
function Consent() {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Globe size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}
        >
          {COPY.lead}
        </div>
        {/* The harvest cost stays visible (doc 17), not behind the expander. */}
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-body)",
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          {COPY.harvest}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            marginTop: 6,
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          <Lock size={13} style={{ flex: "none", marginTop: 2 }} />
          <span>{COPY.sub}</span>
        </div>
        <details style={{ marginTop: 8 }}>
          <summary
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--text-accent)",
              cursor: "pointer",
            }}
          >
            {COPY.details}
          </summary>
          <ul
            style={{
              margin: "8px 0 0",
              paddingLeft: 18,
              fontSize: 12.5,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {COPY.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
