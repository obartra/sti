import type { ReactNode } from "react";
import { useMinWidth } from "../desktop/Desktop.tsx";
import { cx } from "../../lib/cx.ts";
import { Lock, EyeOff, Fingerprint, Key, Check } from "../../design/icons.tsx";
import { PROMISES, type UserPromise } from "../../promises/promises.ts";
import { TrustBoundary } from "./TrustBoundary.tsx";
import "./promises.css";

// The /promises page: a progressive summary of the privacy guarantees. Three plain
// themes a worried reader gets in one pass; under each, the specific promises and the
// concrete things we actually check, every one tagged tested / by design. It mirrors
// the legal pages' layered-notice layout: a plain summary sits beside (wide) or above
// (mobile) the receipts. Read-only and a pure function of the promises data, so it
// stays storyable and the CI gate (promises.test.ts) keeps it from ever claiming more
// than the tests back.

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

function promisesOf(theme: Theme): UserPromise[] {
  return theme.promiseIds
    .map((id) => BY_ID.get(id))
    .filter((p): p is UserPromise => p !== undefined);
}

function AssertionRow({ claim, tested }: { claim: string; tested: boolean }) {
  return (
    <li className="pr__assertion">
      <span
        aria-hidden
        className={cx(
          "pr__assertion-mark",
          tested && "pr__assertion-mark--tested",
        )}
      >
        {tested ? <Check size={15} /> : <span aria-hidden>•</span>}
      </span>
      <span className="pr__assertion-claim">
        {claim}
        <span
          className={cx(
            "pr__assertion-tag",
            tested && "pr__assertion-tag--tested",
          )}
        >
          {tested ? "tested" : "by design"}
        </span>
      </span>
    </li>
  );
}

// One promise's receipts: the plain guarantee, the honest detail (limits and all),
// and the concrete things we actually check.
function PromiseDetail({ promise }: { promise: UserPromise }) {
  return (
    <div className="pr__promise">
      <strong className="pr__promise-plain">{promise.plain}</strong>
      <p className="pr__promise-detail">{promise.detail}</p>
      <ul className="pr__assertions">
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

// One theme: a serif heading with its quiet icon, the plain summary in the
// louder register, and the receipts. Wide screens set the summary beside the
// receipts; mobile stacks them.
function ThemeSection({ theme, twoCol }: { theme: Theme; twoCol: boolean }) {
  const promises = promisesOf(theme);
  const receipts = (
    <div className="pr__receipts">
      {promises.map((p) => (
        <PromiseDetail key={p.id} promise={p} />
      ))}
    </div>
  );
  return (
    <section className="pr__section">
      <h2 className="pr__heading">
        <span aria-hidden className="pr__heading-icon">
          {theme.icon}
        </span>
        {theme.headline}
      </h2>
      {twoCol ? (
        <div className="pr__cols">
          <div className="pr__cols-summary">
            <p className="pr__summary">{theme.summary}</p>
          </div>
          {receipts}
        </div>
      ) : (
        <>
          <p className="pr__summary">{theme.summary}</p>
          {receipts}
        </>
      )}
    </section>
  );
}

function Hero() {
  return (
    <header className="pr__head">
      <span aria-hidden className="pr__head-icon">
        <Lock size={22} />
      </span>
      <h1 className="e-title">Our promises</h1>
      <p className="pr__lead">
        Each one is backed by a real test that runs on every version, and goes
        red the moment the promise stops being true.
      </p>
      <span className="pr__count">
        <span aria-hidden className="pr__count-icon">
          <Check size={14} />
        </span>
        {`Backed by ${LIVE_TESTS} live tests`}
      </span>
    </header>
  );
}

const FOOTNOTE = `A "tested" line is backed by a real test that runs on every version; remove or skip it and that version won't go out. "by design" is an honest limit, stated not hidden.`;

export function Promises({ wide }: { wide?: boolean }) {
  // The app drives the layout off the viewport; stories/tests can pin it.
  const auto = useMinWidth(1080);
  const twoCol = wide ?? auto;
  return (
    <div className="pr">
      <Hero />

      <TrustBoundary wide={twoCol} />

      {THEMES.map((t) => (
        <ThemeSection key={t.id} theme={t} twoCol={twoCol} />
      ))}

      <p className="pr__footnote">{FOOTNOTE}</p>
    </div>
  );
}
