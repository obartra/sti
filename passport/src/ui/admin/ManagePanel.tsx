import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Field, Input } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import { formatUtc } from "./ActivityPanel.tsx";
import { humanBytes } from "./MetricsPanel.tsx";
import "./admin.css";
import type {
  AdminActionResult,
  AdminLookup,
  AdminLookupResult,
  AdminRecordInfo,
} from "./adminApi.ts";

// The A3 management panel (doc 20): the three operator tools that act on a single
// opaque id. Look up a record's metadata (exists / ciphertext byte size / last
// written), disable an account (clear its sync backup), or revoke a link (retire it
// and lock any name it holds). Everything here stays within the blind-store boundary
// (doc 20 A3): the store holds no key, so there is no status, handle, or profile to
// show. This panel renders ONLY existence, byte sizes, timestamps, and the id the
// operator typed, never content. A 401 from any call bubbles up so the page re-locks.

// The transport the panel needs, injected so tests and Storybook drive it without a
// server (and so AdminPage can bind it to its apiBase + token).
export interface ManageOps {
  lookup: (token: string, id: string) => Promise<AdminLookupResult>;
  disable: (token: string, id: string) => Promise<AdminActionResult>;
  revoke: (token: string, id: string) => Promise<AdminActionResult>;
}

// How long a primed destructive action stays armed before it disarms itself, so a
// forgotten confirm can never fire on a later, unrelated click.
const CONFIRM_WINDOW_MS = 3000;

const COPY = {
  title: "Manage records",
  sub: "Look up an opaque id, or disable an account or revoke a link. Metadata only, never content.",
  idLabel: "Record id",
  lookUp: "Look up",
  idle: "Enter a record id to look it up.",
  loading: "Looking it up…",
  notFound: "No record for that id.",
  loadError: "Couldn't look that up. Check your connection and try again.",
  retry: "Retry",
  actError: "That action didn't go through. Try again.",
  present: "Present",
  empty: "None",
  disable: "Disable account",
  disableConfirm: "Confirm: this clears the sync backup.",
  revoke: "Revoke link",
  revokeConfirm:
    "Confirm: the link goes dark and any name it holds is locked for 24 hours.",
} as const;

type Status = "idle" | "loading" | "ready" | "loadError";

// One namespace's metadata, as a flat card: present-or-not, and (when present) its
// ciphertext byte size and last-written time. Never any content, because the store
// holds none to show.
function RecordCard({ label, info }: { label: string; info: AdminRecordInfo }) {
  return (
    <div className="adm-figure">
      <div className="adm-figure__value">
        {info.exists ? COPY.present : COPY.empty}
      </div>
      <div className="adm-figure__label">{label}</div>
      {info.exists && (
        <div className="adm-figure__note">
          {humanBytes(info.sizeBytes)} · {formatUtc(info.updatedAt)}
        </div>
      )}
    </div>
  );
}

// A two-click destructive button: the first click arms it (the label flips to the
// confirm copy) and starts a short disarm timer; the second click within the window
// fires. These actions take a raw operator-typed id with no queue context to check
// it against (unlike ReviewPanel's one-click, where the name comes from the queue),
// so this guards against a fat-fingered id disabling or revoking the wrong record.
export function ConfirmButton({
  idle,
  confirm,
  busy,
  onConfirm,
}: {
  idle: string;
  confirm: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setArmed(false);
  }, []);

  useEffect(() => disarm, [disarm]);

  const onClick = () => {
    if (armed) {
      disarm();
      onConfirm();
      return;
    }
    setArmed(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setArmed(false);
    }, CONFIRM_WINDOW_MS);
  };

  return (
    <Button variant="danger" size="sm" disabled={busy} onClick={onClick}>
      {armed ? confirm : idle}
    </Button>
  );
}

const recordFound = (r: AdminLookup): boolean =>
  r.alias.exists || r.account.exists || r.inbox.exists;

// A found record: the id echoed back, the three namespace cards, and the two
// destructive actions. Split out so ManagePanel stays within its length ceiling.
function FoundRecord({
  target,
  record,
  busy,
  actError,
  onDisable,
  onRevoke,
}: {
  target: string;
  record: AdminLookup;
  busy: boolean;
  actError: string | null;
  onDisable: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="adm-record">
      <div className="adm-item__name">{target}</div>
      <div className="adm-record__grid">
        <RecordCard label="Link" info={record.alias} />
        <RecordCard label="Account" info={record.account} />
        <RecordCard label="Inbox" info={record.inbox} />
      </div>
      {actError !== null && (
        <div className="adm-error adm-error--inline">{actError}</div>
      )}
      <div className="adm-record__row">
        <ConfirmButton
          idle={COPY.disable}
          confirm={COPY.disableConfirm}
          busy={busy}
          onConfirm={onDisable}
        />
        <ConfirmButton
          idle={COPY.revoke}
          confirm={COPY.revokeConfirm}
          busy={busy}
          onConfirm={onRevoke}
        />
      </div>
    </div>
  );
}

export function ManagePanel({
  token,
  ops,
  onUnauthorized,
}: {
  token: string;
  ops: ManageOps;
  onUnauthorized: () => void;
}) {
  const [id, setId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [record, setRecord] = useState<AdminLookup | null>(null);
  // The id the current result belongs to: shown with the result and used as the
  // target for a re-lookup (retry / post-action refresh), so a later edit to the
  // input box never re-points an in-flight action.
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [actError, setActError] = useState<string | null>(null);

  const lookup = useCallback(
    (lookupId: string) => {
      setStatus("loading");
      setActError(null);
      setTarget(lookupId);
      void ops
        .lookup(token, lookupId)
        .then((r) => {
          if (r.kind === "ok") {
            setRecord(r.record);
            setStatus("ready");
          } else if (r.kind === "unauthorized") {
            onUnauthorized();
          } else {
            setStatus("loadError");
          }
        })
        .catch(() => setStatus("loadError"));
    },
    [ops, token, onUnauthorized],
  );

  const onSubmit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      const trimmed = id.trim();
      if (trimmed === "") return;
      lookup(trimmed);
    },
    [id, lookup],
  );

  // Run a destructive action against the current target, then re-lookup to reflect
  // the change and keep the panel usable. A 401 re-locks; a transport error leaves a
  // plain notice without touching the shown record.
  const act = useCallback(
    (op: (token: string, id: string) => Promise<AdminActionResult>) => {
      setBusy(true);
      setActError(null);
      void op(token, target)
        .then((r) => {
          setBusy(false);
          if (r === "ok") lookup(target);
          else if (r === "unauthorized") onUnauthorized();
          else setActError(COPY.actError);
        })
        .catch(() => {
          setBusy(false);
          setActError(COPY.actError);
        });
    },
    [token, target, onUnauthorized, lookup],
  );

  return (
    <section className="adm-panel">
      <PanelHeading title={COPY.title} sub={COPY.sub} />

      <form onSubmit={onSubmit} className="adm-gate__form">
        <Field label={COPY.idLabel} htmlFor="manage-id">
          <Input
            id="manage-id"
            autoComplete="off"
            spellCheck={false}
            value={id}
            disabled={status === "loading"}
            onChange={(e) => setId(e.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          size="md"
          disabled={status === "loading" || id.trim() === ""}
        >
          {COPY.lookUp}
        </Button>
      </form>

      <ResultView
        status={status}
        record={record}
        target={target}
        busy={busy}
        actError={actError}
        onRetry={() => lookup(target)}
        onDisable={() => act(ops.disable)}
        onRevoke={() => act(ops.revoke)}
      />
    </section>
  );
}

// The lookup result: the status-driven body below the form (prompt, spinner, error
// with retry, not-found notice, or the found record). Split out so ManagePanel stays
// within its length ceiling.
function ResultView({
  status,
  record,
  target,
  busy,
  actError,
  onRetry,
  onDisable,
  onRevoke,
}: {
  status: Status;
  record: AdminLookup | null;
  target: string;
  busy: boolean;
  actError: string | null;
  onRetry: () => void;
  onDisable: () => void;
  onRevoke: () => void;
}) {
  if (status === "idle") {
    return <div className="adm-note">{COPY.idle}</div>;
  }
  if (status === "loading") {
    return <div className="adm-note">{COPY.loading}</div>;
  }
  if (status === "loadError") {
    return (
      <div className="adm-retry">
        <div className="adm-error">{COPY.loadError}</div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {COPY.retry}
        </Button>
      </div>
    );
  }
  if (record === null || !recordFound(record)) {
    return <div className="adm-note">{COPY.notFound}</div>;
  }
  return (
    <FoundRecord
      target={target}
      record={record}
      busy={busy}
      actError={actError}
      onDisable={onDisable}
      onRevoke={onRevoke}
    />
  );
}
