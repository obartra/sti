import { useState } from "react";
import { Card } from "../../design/components/index.ts";
import { Lock, Check, Chevron } from "../../design/icons.tsx";
import { PROMISES, type UserPromise } from "../../promises/promises.ts";

// The /promises page: the plain-English guarantees from promises.ts, each openable
// to the concrete things we actually check. Read-only and static (a pure function of
// the promises data), so it stays storyable and the CI gate (promises.test.ts) keeps
// it from ever claiming more than the tests back.

const PAGE_WIDTH = 390;

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

function PromiseCard({ promise }: { promise: UserPromise }) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <strong
        style={{ fontSize: 16.5, color: "var(--text-strong)", lineHeight: 1.3 }}
      >
        {promise.plain}
      </strong>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-subtle)" }}>
        {promise.detail}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
          marginTop: 2,
          padding: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--text-accent)",
        }}
      >
        What we actually check
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 120ms",
          }}
        >
          <Chevron size={14} />
        </span>
      </button>
      {open && (
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            margin: "4px 0 0",
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
        maxWidth: PAGE_WIDTH,
      }}
    >
      <Card
        style={{
          borderRadius: "var(--radius-lg)",
          padding: 22,
          background: "var(--status-clear-bg)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span aria-hidden style={{ color: "var(--status-clear-base)" }}>
          <Lock size={22} />
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text-strong)",
          }}
        >
          Our promises
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-body)" }}>
          Each one is backed by a real test that runs on every version, and goes
          red the moment the promise stops being true.
        </p>
      </Card>

      {PROMISES.map((p) => (
        <PromiseCard key={p.id} promise={p} />
      ))}

      <p
        style={{
          margin: "2px 4px 0",
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
