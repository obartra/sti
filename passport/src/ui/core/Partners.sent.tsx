import { useState } from "react";
import { Button, Card, Avatar } from "../../design/components/index.ts";
import { avatarFor } from "../../lib/avatars.ts";
import { X, UserPlus, Info, Clock, Trash } from "../../design/icons.tsx";
import { COPY, fieldLbl, inputShell } from "./Partners.parts.tsx";

export interface PartnersSentState {
  list: string[];
  draft: string;
  setDraft: (v: string) => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
  confirmDel: boolean;
  setConfirmDel: (v: boolean) => void;
  add: () => void;
  remove: (h: string) => void;
}

export function usePartnersSentState(
  recipients: { handle: string }[],
): PartnersSentState {
  const [list, setList] = useState<string[]>(recipients.map((r) => r.handle));
  const [draft, setDraft] = useState("");
  const [locked, setLocked] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const add = () => {
    const h = draft
      .trim()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/gi, "")
      .toLowerCase();
    if (!h) return;
    setList((p) => (p.includes(h) ? p : [...p, h]));
    setDraft("");
  };
  const remove = (h: string) => setList((p) => p.filter((x) => x !== h));

  return {
    list,
    draft,
    setDraft,
    locked,
    setLocked,
    confirmDel,
    setConfirmDel,
    add,
    remove,
  };
}

function DraftHeader() {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-accent)",
        }}
      >
        {COPY.draftEyebrow}
      </div>
      <h1
        style={{
          fontSize: 23,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
          lineHeight: 1.2,
          marginTop: 6,
        }}
      >
        {COPY.draftTitle}
      </h1>
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
          marginTop: 8,
          margin: 0,
        }}
      >
        {COPY.draftSub}
      </p>
    </div>
  );
}

function DraftTimer({ onLock }: { onLock: () => void }) {
  return (
    <Card
      variant="flat"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Clock size={17} />
      </span>
      <div
        style={{
          flex: 1,
          fontSize: 13.5,
          color: "var(--text-muted)",
          lineHeight: 1.45,
        }}
      >
        {COPY.draftLocksIn}
      </div>
      <Button variant="ghost" size="sm" onClick={onLock}>
        {COPY.lockNow}
      </Button>
    </Card>
  );
}

function DraftRow({
  h,
  onRemove,
}: {
  h: string;
  onRemove: (h: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "7px 6px",
      }}
    >
      <Avatar initials={h} src={avatarFor(h)} size="sm" />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-strong)",
        }}
      >
        @{h}
      </span>
      <button
        type="button"
        aria-label={`Remove @${h}`}
        onClick={() => onRemove(h)}
        style={{
          appearance: "none",
          border: "none",
          background: "var(--surface-sunken)",
          cursor: "pointer",
          width: 30,
          height: 30,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          flex: "none",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function DraftList({ state }: { state: PartnersSentState }) {
  return (
    <div>
      <div style={fieldLbl}>{COPY.draftListTitle}</div>
      <Card
        variant="flat"
        style={{ padding: 6, display: "flex", flexDirection: "column" }}
      >
        {state.list.map((h) => (
          <DraftRow key={h} h={h} onRemove={state.remove} />
        ))}
        {state.list.length === 0 && (
          <div
            style={{
              padding: 14,
              fontSize: 13.5,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            No one in this report
          </div>
        )}
        <div style={{ display: "flex", gap: 8, padding: 6 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-card)",
              border: "1.5px solid var(--border-card)",
              borderRadius: "var(--radius-pill)",
              padding: "0 14px",
              height: 42,
            }}
          >
            <span style={{ color: "var(--text-subtle)", flex: "none" }}>
              <UserPlus size={15} />
            </span>
            <input
              value={state.draft}
              onChange={(e) => state.setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") state.add();
              }}
              placeholder={COPY.draftAddPlaceholder}
              aria-label={COPY.draftAdd}
              style={inputShell}
            />
          </div>
          <Button variant="secondary" size="md" onClick={state.add}>
            {COPY.draftAdd}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function DeleteSection({
  state,
  onDelete,
}: {
  state: PartnersSentState;
  onDelete?: (() => void) | undefined;
}) {
  return (
    <>
      {/* frictionless: delete the whole report before it locks */}
      {!state.confirmDel ? (
        <Button
          variant="ghost"
          size="md"
          block
          icon={<Trash size={16} />}
          onClick={() => state.setConfirmDel(true)}
          style={{ color: "var(--status-expired-fg)" }}
        >
          {COPY.deleteReport}
        </Button>
      ) : (
        <Card
          variant="flat"
          style={{
            borderColor: "var(--expired-100)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {COPY.confirmDeleteTitle}
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--text-body)",
            }}
          >
            {COPY.confirmDeleteBody}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="quiet"
              size="md"
              block
              onClick={() => state.setConfirmDel(false)}
            >
              {COPY.confirmDeleteNo}
            </Button>
            <Button variant="danger" size="md" block onClick={onDelete}>
              {COPY.confirmDeleteYes}
            </Button>
          </div>
        </Card>
      )}
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          display: "flex",
          gap: 6,
          alignItems: "flex-start",
        }}
      >
        <Info size={14} style={{ flex: "none", marginTop: 1 }} />{" "}
        {COPY.deleteReportNote}
      </div>
    </>
  );
}

// DRAFT WINDOW: edit freely or delete the whole thing.
export function DraftView({
  state,
  onDelete,
}: {
  state: PartnersSentState;
  onDelete?: (() => void) | undefined;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <DraftHeader />
      {/* Calm draft window: shown in minutes, never a ticking-seconds threat. */}
      <DraftTimer onLock={() => state.setLocked(true)} />
      <DraftList state={state} />
      <DeleteSection state={state} onDelete={onDelete} />
    </div>
  );
}
