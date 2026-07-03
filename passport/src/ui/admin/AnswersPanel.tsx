import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { PanelHeading } from "./panelChrome.tsx";
import { formatUtc } from "./ActivityPanel.tsx";
import type { FeedbackOps } from "./FeedbackPanel.tsx";
import "./admin.css";
import type { AdminFeedback } from "./adminApi.ts";

// The answers view (doc 35): what people sent through the response form on the
// labs open-questions page. Those arrive as "question" rows in the same blind
// feedback store, each carrying a fixed topic code naming which question it
// answers, so this panel reads the shared queue, keeps only the question rows,
// and groups them by question with a count per question. One action per row,
// Resolve, plus a CSV download of the whole set for reading offline. A 401 from
// any call bubbles up so the page re-locks.

// The open questions, in the labs doc's order, keyed by the fixed topic codes
// the server validates. Labels mirror the labs form so the operator and the
// person answering see the same names; the numbers are display only (the codes
// are semantic so the doc can renumber without breaking stored rows).
const TOPICS: { code: string; label: string }[] = [
  { code: "general", label: "In general" },
  { code: "blue-equity", label: "1 · Who can show blue" },
  { code: "condom-tier", label: "2 · Condoms in the same tier" },
  { code: "language", label: "3 · Language" },
  { code: "help-or-harm", label: "4 · Help or harm" },
  { code: "groups", label: "5 · Groups" },
  { code: "active-infection", label: "6 · The active-infection line" },
  { code: "notification-feel", label: "7 · Partner notification" },
  { code: "verification", label: "8 · Verification" },
  { code: "testing-window", label: "9 · The testing window" },
  { code: "detectable-hiv", label: "10 · Detectable HIV and condoms" },
  { code: "missing", label: "11 · Something I'm not seeing" },
];

// A row with a missing or unrecognized topic reads as a general answer rather
// than vanishing (the server validates codes, so this is a belt-and-braces
// default, not an expected path).
function topicOf(r: AdminFeedback): string {
  const t = r.topic ?? "";
  return TOPICS.some((x) => x.code === t) ? t : "general";
}

function topicLabel(code: string): string {
  return TOPICS.find((t) => t.code === code)?.label ?? code;
}

/**
 * The answer rows as CSV for offline reading (a spreadsheet, a grep). Fields
 * with commas, quotes, or newlines are quoted per RFC 4180; the time is the
 * same UTC instant the panel shows. Pure and exported so tests pin the shape
 * and the escaping without driving a browser download.
 */
export function buildAnswersCsv(rows: AdminFeedback[]): string {
  const esc = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
  const lines = ["id,topic,question,sent_at_utc,body"];
  for (const r of rows) {
    const code = topicOf(r);
    lines.push(
      [
        String(r.id),
        code,
        esc(topicLabel(code)),
        new Date(r.createdAt).toISOString(),
        esc(r.body),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

// Hand the CSV to the browser as a file save. Kept tiny and untested-by-design:
// the interesting part (the CSV itself) is the pure builder above.
function saveCsv(rows: AdminFeedback[]) {
  const blob = new Blob([buildAnswersCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "labs-answers.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const COPY = {
  title: "Answers",
  sub: "What people sent through the response form on the labs open-questions page, grouped by question.",
  loading: "Loading answers…",
  empty: "No answers yet.",
  loadError: "Couldn't load answers. Check your connection and try again.",
  actError: "That didn't go through. Try again.",
  retry: "Retry",
  resolve: "Resolve",
  noText: "Nothing written.",
  download: "Download CSV",
} as const;

type Status = "loading" | "ready" | "loadError";

export function AnswersPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  // The same transport as the feedback queue: answers live in the same store.
  ops: FeedbackOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [answers, setAnswers] = useState<AdminFeedback[]>([]);
  const [busy, setBusy] = useState<number | null>(null); // the id being resolved
  const [actError, setActError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setActError(null);
    void ops
      .list(token)
      .then((r) => {
        if (r.kind === "ok") {
          // Everything else in the shared queue belongs to the FeedbackPanel.
          setAnswers(r.feedback.filter((f) => f.reason === "question"));
          setStatus("ready");
        } else if (r.kind === "unauthorized") {
          onUnauthorized();
        } else {
          setStatus("loadError");
        }
      })
      .catch(() => setStatus("loadError"));
  }, [ops, token, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const resolve = useCallback(
    (id: number) => {
      setBusy(id);
      setActError(null);
      void ops
        .resolve(token, id)
        .then((r) => {
          setBusy(null);
          if (r === "ok") load();
          else if (r === "unauthorized") onUnauthorized();
          else setActError(COPY.actError);
        })
        .catch(() => {
          setBusy(null);
          setActError(COPY.actError);
        });
    },
    [ops, token, onUnauthorized, load],
  );

  // The questions that actually have answers, in the doc's order, each with its
  // rows (newest first, as the server returns them).
  const groups = TOPICS.map((t) => ({
    ...t,
    rows: answers.filter((a) => topicOf(a) === t.code),
  })).filter((g) => g.rows.length > 0);

  return (
    <section className="adm-panel">
      <PanelHeading
        title={COPY.title}
        sub={COPY.sub}
        count={status === "ready" ? answers.length : undefined}
      />

      {status === "loading" && <div className="adm-note">{COPY.loading}</div>}

      {status === "loadError" && (
        <div className="adm-retry">
          <div className="adm-error">{COPY.loadError}</div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {status === "ready" && answers.length === 0 && (
        <div className="adm-note">{COPY.empty}</div>
      )}

      {status === "ready" && answers.length > 0 && (
        <div className="adm-answers">
          {actError !== null && (
            <div className="adm-error adm-error--inline">{actError}</div>
          )}
          <div className="adm-answers__bar">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => saveCsv(answers)}
            >
              {COPY.download}
            </Button>
          </div>
          <div className="adm-figures adm-figures--compact">
            {groups.map((g) => (
              <div key={g.code} className="adm-figure">
                <div className="adm-figure__value">{g.rows.length}</div>
                <div className="adm-figure__label">{g.label}</div>
              </div>
            ))}
          </div>
          {groups.map((g) => (
            <div key={g.code} className="adm-answers__group">
              <div className="e-eyebrow">{g.label}</div>
              <div className="adm-list">
                {g.rows.map((r) => (
                  <AnswerRow
                    key={r.id}
                    answer={r}
                    busy={busy === r.id}
                    onResolve={resolve}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// UTC like the other admin timestamps, guarded like FeedbackPanel's (toISOString
// throws on an invalid date, and a bad row must not blank the whole view).
function fmtTime(ms: number): string {
  try {
    return formatUtc(ms);
  } catch {
    return "";
  }
}

function AnswerRow({
  answer,
  busy,
  onResolve,
}: {
  answer: AdminFeedback;
  busy: boolean;
  onResolve: (id: number) => void;
}) {
  const text = answer.body.trim();
  return (
    <div className="adm-item">
      <div className="adm-item__row">
        <div className="adm-item__body adm-item__body--grow">
          {text === "" ? COPY.noText : text}
        </div>
        <div className="adm-item__time">{fmtTime(answer.createdAt)}</div>
      </div>
      <div className="adm-item__actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => onResolve(answer.id)}
        >
          {COPY.resolve}
        </Button>
      </div>
    </div>
  );
}
