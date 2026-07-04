import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Field, Input } from "../../design/components/index.ts";
import { cx } from "../../lib/cx.ts";
import "../core/settings.css";
import "./findable.css";
import { Globe, Lock, Copy, Check, Trash, Plus } from "../../design/icons.tsx";
import {
  normalizeVanityName,
  vanityNameError,
  type VanityNameError,
} from "../../store/vanityName.ts";
import { MAX_PUBLIC_NAMES } from "../../store/accountBlob.ts";
import { copyText } from "../../lib/clipboard.ts";
import { publicLinkFor, publicHttpsLinkFor } from "./shareLinkGuideCopy.ts";
import type { VanityRegisterResult } from "../../api/client.ts";

// The owner's public-name manager (doc 17), on the Links tab: a list of up to
// MAX_PUBLIC_NAMES claimed names, each backed by its own dedicated public alias, plus
// an add flow behind an explicit consent disclosure. The transport is injected
// (FindableOps) so this is driven in tests/Storybook without a server, and so the
// parent binds it to the right aliases + persists each chosen name. The list is
// prop-driven: a claim or removal folds the owner session a layer up, which flows
// back in as a fresh `names`, so the component never tracks its own list.

export interface FindableOps {
  /** Claim `name` for the owner. Returns the outcome, never throws on the
   * expected "unavailable" (taken/reserved/blocked) case. */
  register: (name: string) => Promise<VanityRegisterResult>;
  /** Look up if `name` is free, without claiming it, so the form can answer as the
   * owner types. `name` is already normalized + format-valid. */
  check: (name: string) => Promise<"free" | "taken" | "error">;
  /** Release the named registration into the 24h lock (no-op if not held). */
  release: (name: string) => Promise<void>;
}

export interface PublicNamesProps {
  /** The owner's claimed public names, in claim order. Empty when none. */
  names: string[];
  ops: FindableOps;
  /** The name pinned as the sign-in username (doc 32), if any: it cannot be
   * removed, so its row shows the reason instead of a remove control. The server
   * enforces the same rule (doc 17); this is the matching UI. */
  pinnedName?: string | null | undefined;
}

const NAME_ERROR: Record<VanityNameError, string> = {
  "too-short": "Use at least 3 characters.",
  "too-long": "Use at most 30 characters.",
  "bad-chars": "Lowercase letters, numbers, and _ only.",
  reserved: "That name is reserved.",
};

const COPY = {
  sectionTitle: "Public names",
  sectionLead: "Names people can look you up by. You can have up to 5.",
  // A calm empty state when the owner holds none.
  empty:
    "You have no public names yet. Add one so people can find you and ask to see your status.",
  add: "Add a public name",
  // Shown in place of the add control once the list is full (doc 17 cap).
  atCap: "You have the maximum of 5.",
  cancel: "Cancel",
  // The consent disclosure (doc 17 launch-gate item 5): one honest line up front, so
  // being findable openly is a knowing choice. Stays visible, never behind the
  // expander. This is honest consent for an opt-in public feature.
  lead: "Your name becomes public, so anyone can see you have a passport here.",
  sub: "Your status itself stays private. People still ask to see it, and you approve.",
  details: "What else this means",
  bullets: [
    "Remove a name and, after a short delay, anyone can claim it.",
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
  linkLabel: "People can find you at:",
  copy: "Copy link",
  copied: "Copied",
  remove: "Remove",
  removing: "Removing…",
  // Shown in place of the remove control when the name is the owner's sign-in
  // username (doc 32): removing it would break the password login, so we point at
  // the fix instead of a dead end. Matches the server's refusal reason.
  pinned:
    "This name is your sign-in username. Turn the password off first to remove it.",
} as const;

export function PublicNames({
  names,
  ops,
  pinnedName = null,
}: PublicNamesProps) {
  const [adding, setAdding] = useState(false);
  const atCap = names.length >= MAX_PUBLIC_NAMES;
  return (
    <section className="pn">
      <div className="st__block-head">
        <span aria-hidden className="st__block-icon">
          <Globe size={18} />
        </span>
        <div className="st__block-body">
          <div className="st__block-title">{COPY.sectionTitle}</div>
          <div className="st__block-lead">{COPY.sectionLead}</div>
        </div>
      </div>

      {names.length === 0 && !adding && (
        <div className="st__note">{COPY.empty}</div>
      )}

      {names.length > 0 && (
        <div className="pn__list">
          {names.map((name) => (
            <NameRow
              key={name}
              name={name}
              ops={ops}
              pinned={name === pinnedName}
            />
          ))}
        </div>
      )}

      {adding ? (
        <RegisterForm
          ops={ops}
          onRegistered={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="pn__add">
          <Button
            variant="secondary"
            size="md"
            icon={<Plus size={16} />}
            disabled={atCap}
            onClick={() => setAdding(true)}
          >
            {COPY.add}
          </Button>
          {atCap && <div className="st__note">{COPY.atCap}</div>}
        </div>
      )}
    </section>
  );
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
    <div className={cx("st__status", isError && "st__status--error")}>
      {text}
    </div>
  );
}

// The add flow: the consent disclosure + the name picker. A successful claim folds
// the session a layer up (the list grows via props) and calls onRegistered so the
// section closes the form; onCancel backs out without claiming.
function RegisterForm({
  ops,
  onRegistered,
  onCancel,
}: {
  ops: FindableOps;
  onRegistered: () => void;
  onCancel: () => void;
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
          if (result === "registered") onRegistered();
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
    <div className="st__block">
      <Consent />
      <form onSubmit={submit} className="st__form">
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
        <div className="pn__form-actions">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={busy}
            onClick={onCancel}
          >
            {COPY.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={blockSubmit}
          >
            {busy ? COPY.claiming : COPY.claim}
          </Button>
        </div>
      </form>
    </div>
  );
}

// One claimed name: the name, its public link with a one-tap copy, and a remove
// control (or, when the name is the sign-in username, the plain pin reason). A
// removal folds the session a layer up, so the row simply unmounts as `names` shrinks.
function NameRow({
  name,
  ops,
  pinned,
}: {
  name: string;
  ops: FindableOps;
  pinned: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!copyText(publicHttpsLinkFor(name))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const remove = useCallback(() => {
    setBusy(true);
    setError(null);
    void ops
      .release(name)
      // The server enforces the pin too (doc 17): if a password was set on this name
      // (e.g. in another tab) after we rendered, it refuses with a 409. Surface the
      // plain reason rather than a generic failure.
      .catch((e: unknown) =>
        setError(isPinRefusal(e) ? COPY.pinned : COPY.failed),
      )
      .finally(() => setBusy(false));
  }, [ops, name]);

  return (
    <div className="pn__row">
      <div className="pn__row-body">
        <div className="st__mono">{name}</div>
        <div className="pn__link">
          <span className="pn__link-label">{COPY.linkLabel}</span>
          <span className="pn__link-value">{publicLinkFor(name)}</span>
        </div>
        {error !== null && <div className="st__error">{error}</div>}
      </div>
      <div className="pn__row-actions">
        <Button
          variant="ghost"
          size="sm"
          icon={copied ? <Check size={15} /> : <Copy size={15} />}
          onClick={copy}
        >
          {copied ? COPY.copied : COPY.copy}
        </Button>
        {/* Pinned (doc 32): this name is the sign-in username, so we do not offer to
            remove it. Show the fix instead of a control that would be refused. */}
        {pinned ? (
          <span className="st__note">{COPY.pinned}</span>
        ) : (
          <Button
            variant="quiet"
            size="sm"
            icon={<Trash size={15} />}
            disabled={busy}
            onClick={remove}
          >
            {busy ? COPY.removing : COPY.remove}
          </Button>
        )}
      </div>
    </div>
  );
}

// A remove the server refused because the name carries a password login (doc 17
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
    <div className="st__block-head">
      <span aria-hidden className="st__block-icon">
        <Globe size={18} />
      </span>
      <div className="st__block-body">
        <div className="st__block-title">{COPY.lead}</div>
        <div className="st__lockline">
          <span aria-hidden className="st__lockline-icon">
            <Lock size={13} />
          </span>
          <span>{COPY.sub}</span>
        </div>
        <details className="st__details">
          <summary>{COPY.details}</summary>
          <ul>
            {COPY.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
