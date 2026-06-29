import { useState } from "react";
import type { ReactNode } from "react";
import { Card } from "../../design/components/index.ts";
import {
  Lock,
  EyeOff,
  Fingerprint,
  Key,
  Check,
  Chevron,
} from "../../design/icons.tsx";
import { PROMISES, type UserPromise } from "../../promises/promises.ts";

// The /promises page: a progressive summary of the privacy guarantees. Three plain
// themes a worried reader gets in one pass; open any theme to see its specific
// promises and the concrete things we actually check, each tagged tested / by
// design. Read-only and a pure function of the promises data, so it stays storyable
// and the CI gate (promises.test.ts) keeps it from ever claiming more than the tests
// back.

// How many assertions are pinned by a real, build-failing test (not reasoning):
// the honest, concrete proof number shown up top.
const LIVE_TESTS = PROMISES.reduce(
  (n, p) => n + p.assertions.filter((a) => a.backedBy.kind === "test").length,
  0,
);

const BY_ID = new Map(PROMISES.map((p) => [p.id, p]));

// The three themes the promises group into. Headlines and summaries are honest
// roll-ups of the member promises (the precise, tested wording lives in each
// promise below); they never claim more than their members deliver.
interface Theme {
  readonly id: string;
  readonly icon: ReactNode;
  readonly headline: string;
  readonly summary: string;
  readonly promiseIds: readonly string[];
}

export const THEMES: readonly Theme[] = [
  {
    id: "unseen",
    icon: <EyeOff size={20} />,
    headline: "What we can never see",
    summary:
      "It's encrypted before it leaves your phone, never asks who you are, and no one can even tell you saved anything.",
    promiseIds: ["cannot-read", "no-name", "cannot-tell-existence"],
  },
  {
    id: "untraceable",
    icon: <Fingerprint size={20} />,
    headline: "What can't be traced back to you",
    summary:
      "A heads-up to get tested names no one, and your separate links can't be tied together or back to you.",
    promiseIds: ["contentless-notify", "unlinkable-siblings", "no-unique-tag"],
  },
  {
    id: "yours",
    icon: <Key size={20} />,
    headline: "What stays in your hands",
    summary:
      "Turn any link off for good, change or delete everything with a secret only you hold, and claim a public name only with eyes open.",
    promiseIds: ["revoke", "only-you", "findable-honest"],
  },
];

function AssertionRow({ claim, tested }: { claim: string; tested: boolean }) {
  return (
    <li
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        listStyle: "none",
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          marginTop: 1,
          color: tested ? "var(--status-clear-base)" : "var(--text-subtle)",
        }}
      >
        {tested ? <Check size={15} /> : <span aria-hidden>•</span>}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-body)" }}>
        {claim}
        <span
          style={{
            marginLeft: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: tested ? "var(--status-clear-base)" : "var(--text-subtle)",
          }}
        >
          {tested ? "tested" : "by design"}
        </span>
      </span>
    </li>
  );
}

// One promise inside an open theme: the plain guarantee, the honest detail (limits
// and all), and the concrete things we actually check.
function PromiseDetail({ promise }: { promise: UserPromise }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <strong
        style={{ fontSize: 15.5, color: "var(--text-strong)", lineHeight: 1.3 }}
      >
        {promise.plain}
      </strong>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-subtle)" }}>
        {promise.detail}
      </p>
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          margin: "2px 0 0",
          padding: 0,
        }}
      >
        {promise.assertions.map((a, i) => (
          <AssertionRow
            key={i}
            claim={a.claim}
            tested={a.backedBy.kind === "test"}
          />
        ))}
      </ul>
    </div>
  );
}

function ThemeBlock({ theme }: { theme: Theme }) {
  const [open, setOpen] = useState(false);
  const promises = theme.promiseIds
    .map((id) => BY_ID.get(id))
    .filter((p): p is UserPromise => p !== undefined);
  return (
    <Card
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          appearance: "none",
          border: "none",
          background: "none",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: 20,
        }}
      >
        <span
          aria-hidden
          style={{
            flex: "none",
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "var(--status-clear-bg)",
            color: "var(--status-clear-base)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {theme.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "var(--text-strong)",
            }}
          >
            {theme.headline}
          </span>
          <span
            style={{
              display: "block",
              margin: "5px 0 8px",
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-body)",
            }}
          >
            {theme.summary}
          </span>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--text-accent)",
            }}
          >
            {open ? "Hide the specifics" : "See the specifics"}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            flex: "none",
            marginTop: 2,
            color: "var(--text-subtle)",
            display: "inline-flex",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 120ms",
          }}
        >
          <Chevron size={18} />
        </span>
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            padding: "4px 20px 20px",
          }}
        >
          {promises.map((p) => (
            <PromiseDetail key={p.id} promise={p} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function Promises() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        width: "100%",
      }}
    >
      <Card
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "26px 24px",
          background: "var(--status-clear-bg)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <span aria-hidden style={{ color: "var(--status-clear-base)" }}>
          <Lock size={22} />
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "var(--text-strong)",
          }}
        >
          Our promises
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 560,
            fontSize: 14.5,
            lineHeight: 1.5,
            color: "var(--text-body)",
          }}
        >
          Each one is backed by a real test that runs on every version, and goes
          red the moment the promise stops being true.
        </p>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            padding: "5px 11px",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-card)",
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--status-clear-base)",
          }}
        >
          <Check size={14} />
          {`Backed by ${LIVE_TESTS} live tests`}
        </span>
      </Card>

      {THEMES.map((t) => (
        <ThemeBlock key={t.id} theme={t} />
      ))}

      <p
        style={{
          margin: "2px 4px 0",
          maxWidth: 640,
          fontSize: 12,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
        }}
      >
        {`A "tested" line is backed by a real test that runs on every version; remove or skip it and that version won't go out. "by design" is an honest limit, stated not hidden.`}
      </p>
    </div>
  );
}
