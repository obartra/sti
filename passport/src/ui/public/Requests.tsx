import { useEffect, useState } from "react";
import { Card, Button } from "../../design/components/index.ts";
import { ArrowRight, Back } from "../../design/icons.tsx";
import { backBtn } from "./PublicResolution.copy.ts";
import type { ResolvedView } from "./PublicResolution.tsx";
import type { PendingKnock } from "../../store/index.ts";
import { relativeDayLabel, todayEpochDay } from "../../core/clock.ts";

// The viewer's own list of access requests they've made (doc 13/16), the way back
// for a logged-out viewer. On open it quietly re-checks each one: if the owner has
// shared since, the row becomes openable; if not, it stays a calm "nothing yet"
// with no granted/denied signal (existence-uniform). Device-local, no account.

const COPY = {
  title: "Links you asked to see",
  intro: "When someone shares their status with you, it shows up here.",
  empty: "Nothing here yet. When you ask to see someone, it shows up here.",
  ready: "Shared with you",
  readyCta: "See their status",
  waiting: "Nothing to show yet",
  forget: "Remove",
} as const;

type RowState = "checking" | "ready" | "waiting";

export interface RequestsProps {
  requests: PendingKnock[];
  // Re-check one request for an approved grant; the store's redeemGrant, which is
  // existence-uniform and safe to call repeatedly.
  resolve: (aliasId: string) => Promise<ResolvedView | null>;
  // Open a ready request's card (routes to the public resolution screen, which
  // redeems and shows the status).
  onOpen: (aliasId: string) => void;
  // Forget one request the viewer no longer wants in their list.
  onForget: (aliasId: string) => void;
  onBack?: () => void;
}

export function Requests({
  requests,
  resolve,
  onOpen,
  onForget,
  onBack,
}: RequestsProps) {
  // Per-alias re-check result. Keyed on the id list so it re-runs if the set
  // changes (e.g. after a forget), not on every array-identity churn.
  const [states, setStates] = useState<Record<string, RowState>>({});
  const ids = requests.map((r) => r.id).join(",");
  useEffect(() => {
    let active = true;
    for (const { id } of requests) {
      void resolve(id)
        .then((view) => {
          if (active)
            setStates((s) => ({ ...s, [id]: view ? "ready" : "waiting" }));
        })
        .catch(() => {
          if (active) setStates((s) => ({ ...s, [id]: "waiting" }));
        });
    }
    return () => {
      active = false;
    };
    // requests is rebuilt each render; ids is the stable signal for the set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, resolve]);

  const today = todayEpochDay();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={backBtn}
        >
          <Back size={20} />
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.title}
        </h1>
      </div>

      {requests.length === 0 ? (
        <Card variant="tint">
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--text-muted)",
            }}
          >
            {COPY.empty}
          </p>
        </Card>
      ) : (
        <>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--text-muted)",
            }}
          >
            {COPY.intro}
          </p>
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              state={states[r.id] ?? "checking"}
              askedLabel={relativeDayLabel(r.at, today)}
              onOpen={() => onOpen(r.id)}
              onForget={() => onForget(r.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function RequestRow({
  state,
  askedLabel,
  onOpen,
  onForget,
}: {
  state: RowState;
  askedLabel: string;
  onOpen: () => void;
  onForget: () => void;
}) {
  const ready = state === "ready";
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: ready ? "var(--text-strong)" : "var(--text-muted)",
          }}
        >
          {ready ? COPY.ready : COPY.waiting}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>
          {askedLabel}
        </span>
      </div>
      {ready && (
        <Button variant="primary" size="md" block onClick={onOpen}>
          {COPY.readyCta} <ArrowRight size={17} />
        </Button>
      )}
      <button
        type="button"
        onClick={onForget}
        style={{
          alignSelf: "flex-start",
          padding: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12.5,
          color: "var(--text-subtle)",
          textDecoration: "underline",
        }}
      >
        {COPY.forget}
      </button>
    </Card>
  );
}
