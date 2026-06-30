import { useCallback, useState } from "react";
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
// Gated by FINDABLE_ENABLED at the call site; this component assumes it's allowed.

export interface FindableOps {
  /** Claim `name` for the owner's alias. Returns the outcome, never throws on the
   * expected "unavailable" (taken/reserved/blocked) case. */
  register: (name: string) => Promise<VanityRegisterResult>;
  /** Release the currently registered name into the 24h lock. */
  release: () => Promise<void>;
}

export interface FindableNameProps {
  /** The owner's currently registered name, or null if none. */
  currentName: string | null;
  ops: FindableOps;
  /** Persist the result: the new name on a claim, or null on release. */
  onChange?: (name: string | null) => void;
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
} as const;

export function FindableName({
  currentName,
  ops,
  onChange,
}: FindableNameProps) {
  if (currentName !== null) {
    return (
      <RegisteredView
        name={currentName}
        ops={ops}
        onReleased={() => onChange?.(null)}
      />
    );
  }
  return <RegisterForm ops={ops} onRegistered={(n) => onChange?.(n)} />;
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
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      const normalized = normalizeVanityName(name);
      const bad = vanityNameError(normalized);
      if (bad !== null) {
        setError(NAME_ERROR[bad]);
        return;
      }
      setError(null);
      setBusy(true);
      void ops
        .register(normalized)
        .then((result) => {
          if (result === "registered") onRegistered(normalized);
          else if (result === "unavailable") setError(COPY.unavailable);
          else setError(COPY.failed);
        })
        .catch(() => setError(COPY.failed))
        .finally(() => setBusy(false));
    },
    [name, ops, onRegistered],
  );

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Consent />
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <Field
          label={COPY.label}
          htmlFor="vanity-name"
          error={error ?? undefined}
        >
          <Input
            id="vanity-name"
            value={name}
            error={error !== null}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. robin"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="md"
          block
          disabled={busy || normalizeVanityName(name) === ""}
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
}: {
  name: string;
  ops: FindableOps;
  onReleased: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const release = useCallback(() => {
    setBusy(true);
    setError(null);
    void ops
      .release()
      .then(onReleased)
      .catch(() => setError(COPY.failed))
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
      <Button variant="secondary" size="md" disabled={busy} onClick={release}>
        {busy ? COPY.releasing : COPY.release}
      </Button>
    </Card>
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
