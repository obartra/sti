import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";
import { Lock, ShieldCheck } from "../../design/icons.tsx";
import { useMinWidth } from "../desktop/Desktop.tsx";
import {
  actOnVanityName,
  getAdminMetrics,
  listAdminAudit,
  listAdminFeedback,
  listAdminReports,
  pingAdmin,
  resolveFeedback,
  type AdminPingResult,
} from "./adminApi.ts";
import {
  clearAdminToken,
  readAdminToken,
  saveAdminToken,
} from "./adminToken.ts";
import { ReviewPanel, type ReviewOps } from "./ReviewPanel.tsx";
import { ActivityPanel, type AuditOps } from "./ActivityPanel.tsx";
import { MetricsPanel, type MetricsOps } from "./MetricsPanel.tsx";
import { FeedbackPanel, type FeedbackOps } from "./FeedbackPanel.tsx";

// The operator surface (doc 20): a dedicated, gated /admin page, isolated from the
// user flows and never linked from the app. It renders nothing actionable until a
// valid bearer is present: the operator types the secret, the page validates it
// with a cheap GET /admin/ping, and only then shows the panel shell. A1 is the
// gate itself; the Findable review panel (A2) drops into the authed shell later.

const COPY = {
  lockTitle: "Admin",
  lockSub: "Enter the operator token to continue.",
  tokenLabel: "Operator token",
  unlock: "Unlock",
  checking: "Checking the token…",
  authedTitle: "Admin",
  authedSub: "Operator session active.",
  lockAgain: "Lock",
  errBadToken: "That token was not accepted.",
  errUnreachable:
    "Couldn't reach the admin service. Check your connection and try again.",
  errExpired: "Your session ended. Enter the token again.",
} as const;

type Phase = "locked" | "checking" | "authed";

export interface AdminPageProps {
  /** The api origin the admin endpoints live on (e.g. https://api.sti.care). */
  apiBase: string;
  /**
   * Token validator. Defaults to the real ping; injectable so tests and Storybook
   * drive the gate without a server.
   */
  ping?: (token: string) => Promise<AdminPingResult>;
  /**
   * Review-queue transport. Defaults to the real admin endpoints bound to apiBase;
   * injectable so tests and Storybook drive the panel without a server.
   */
  reviewOps?: ReviewOps;
  /**
   * Recent-activity transport (A4). Defaults to the real audit endpoint bound to
   * apiBase; injectable so tests and Storybook drive the panel without a server.
   */
  auditOps?: AuditOps;
  /**
   * Service-metrics transport (A5). Defaults to the real metrics endpoint bound to
   * apiBase; injectable so tests and Storybook drive the panel without a server.
   */
  metricsOps?: MetricsOps;
  /**
   * "Something wrong?" review transport (doc 35). Defaults to the real feedback
   * endpoints bound to apiBase; injectable so tests and Storybook drive it.
   */
  feedbackOps?: FeedbackOps;
}

// Build the panel transports: each defaults to the real admin endpoints bound to
// apiBase, or uses the injected stub (tests / Storybook). Hoisted out of AdminPage
// so the component stays within its length ceiling.
function useAdminTransports(
  apiBase: string,
  over: {
    reviewOps?: ReviewOps | undefined;
    auditOps?: AuditOps | undefined;
    metricsOps?: MetricsOps | undefined;
    feedbackOps?: FeedbackOps | undefined;
  },
): {
  ops: ReviewOps;
  audit: AuditOps;
  metrics: MetricsOps;
  feedback: FeedbackOps;
} {
  const { reviewOps, auditOps, metricsOps, feedbackOps } = over;
  const ops = useMemo<ReviewOps>(
    () =>
      reviewOps ?? {
        list: (t) => listAdminReports(apiBase, t),
        act: (t, name, action) =>
          actOnVanityName({ apiBase, token: t, name, action }),
      },
    [reviewOps, apiBase],
  );
  const audit = useMemo<AuditOps>(
    () =>
      auditOps ?? { list: (t, before) => listAdminAudit(apiBase, t, before) },
    [auditOps, apiBase],
  );
  const metrics = useMemo<MetricsOps>(
    () => metricsOps ?? { get: (t) => getAdminMetrics(apiBase, t) },
    [metricsOps, apiBase],
  );
  const feedback = useMemo<FeedbackOps>(
    () =>
      feedbackOps ?? {
        list: (t) => listAdminFeedback(apiBase, t),
        resolve: (t, id) => resolveFeedback(apiBase, t, id),
      },
    [feedbackOps, apiBase],
  );
  return { ops, audit, metrics, feedback };
}

// The token-gate state machine, split out so AdminPage stays within its length
// ceiling: the phase + token + error, the mount-time validate of a stored token,
// the submit/lock/expire transitions, and the single applyResult that turns a ping
// outcome into UI state so the mount and submit paths can never diverge.
function useAdminGate(validate: (token: string) => Promise<AdminPingResult>) {
  const [phase, setPhase] = useState<Phase>("locked");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A valid token persists + shows the panel; a rejected token is cleared with a
  // "wrong token" notice; a TRANSPORT failure keeps the token (a reload can still
  // validate it once the service is reachable) and only shows the unreachable
  // notice. Callers map a rejected promise to the transport branch, so the gate
  // can never get stuck mid-check.
  const applyResult = useCallback(
    (candidate: string, result: AdminPingResult) => {
      if (result === "ok") {
        saveAdminToken(candidate);
        setToken(candidate);
        setPhase("authed");
        return;
      }
      if (result === "unauthorized") {
        clearAdminToken();
        setError(COPY.errBadToken);
      } else {
        setError(COPY.errUnreachable);
      }
      setPhase("locked");
    },
    [],
  );

  // On mount, confirm any token already stored for this tab before showing anything.
  // Guarded against a post-unmount result (and StrictMode's double-mount), and
  // `.catch` maps a rejecting validator to the transport branch, not a stuck spinner.
  useEffect(() => {
    const stored = readAdminToken();
    if (stored === null) return;
    let live = true;
    setPhase("checking");
    void validate(stored)
      .then((result) => {
        if (live) applyResult(stored, result);
      })
      .catch(() => {
        if (live) applyResult(stored, "error");
      });
    return () => {
      live = false;
    };
  }, [validate, applyResult]);

  const onSubmit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      const candidate = token.trim();
      if (candidate === "") return;
      setError(null);
      setPhase("checking");
      void validate(candidate)
        .then((result) => applyResult(candidate, result))
        .catch(() => applyResult(candidate, "error"));
    },
    [token, validate, applyResult],
  );

  const lock = useCallback(() => {
    clearAdminToken();
    setToken("");
    setError(null);
    setPhase("locked");
  }, []);

  // A 401 from a panel call means the token stopped being valid (rotated/expired):
  // drop it and return to the gate with a notice, distinct from a manual lock.
  const expire = useCallback(() => {
    clearAdminToken();
    setToken("");
    setError(COPY.errExpired);
    setPhase("locked");
  }, []);

  return { phase, token, setToken, error, onSubmit, lock, expire };
}

export function AdminPage({
  apiBase,
  ping,
  reviewOps,
  auditOps,
  metricsOps,
  feedbackOps,
}: AdminPageProps) {
  const validate = useCallback(
    (token: string) => (ping ? ping(token) : pingAdmin(apiBase, token)),
    [ping, apiBase],
  );
  const { ops, audit, metrics, feedback } = useAdminTransports(apiBase, {
    reviewOps,
    auditOps,
    metricsOps,
    feedbackOps,
  });
  const { phase, token, setToken, error, onSubmit, lock, expire } =
    useAdminGate(validate);

  // Admin bypasses the app's Chrome (it is an isolated takeover), so it owns its
  // own centered page frame rather than inheriting the consumer shell's.
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "48px 20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          // The authed console spreads its panels across the desktop width; the
          // lock gate stays a compact, centered sign-in card.
          maxWidth: phase === "authed" ? 1080 : 420,
        }}
      >
        {phase === "authed" ? (
          <AuthedShell
            token={token}
            ops={ops}
            auditOps={audit}
            metricsOps={metrics}
            feedbackOps={feedback}
            onLock={lock}
            onExpire={expire}
          />
        ) : (
          <LockGate
            token={token}
            onToken={setToken}
            onSubmit={onSubmit}
            busy={phase === "checking"}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

function LockGate({
  token,
  onToken,
  onSubmit,
  busy,
  error,
}: {
  token: string;
  onToken: (v: string) => void;
  onSubmit: (e: React.SyntheticEvent) => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <Lock size={18} />
        </span>
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {COPY.lockTitle}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {COPY.lockSub}
          </div>
        </div>
      </div>
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <Field
          label={COPY.tokenLabel}
          htmlFor="admin-token"
          error={error ?? undefined}
        >
          <Input
            id="admin-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            error={error !== null}
            disabled={busy}
            onChange={(e) => onToken(e.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="md"
          block
          disabled={busy || token.trim() === ""}
        >
          {busy ? COPY.checking : COPY.unlock}
        </Button>
      </form>
    </Card>
  );
}

function AuthedShell({
  token,
  ops,
  auditOps,
  metricsOps,
  feedbackOps,
  onLock,
  onExpire,
}: {
  token: string;
  ops: ReviewOps;
  auditOps: AuditOps;
  metricsOps: MetricsOps;
  feedbackOps: FeedbackOps;
  onLock: () => void;
  onExpire: () => void;
}) {
  const twoCol = useMinWidth(900);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <ShieldCheck size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {COPY.authedTitle}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {COPY.authedSub}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onLock}>
          {COPY.lockAgain}
        </Button>
      </div>
      {/* The metrics dashboard spans the full width above the review/activity row:
          it is the at-a-glance health read, the panels below are the work queues. */}
      <MetricsPanel token={token} ops={metricsOps} onUnauthorized={onExpire} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: twoCol ? "minmax(0, 1fr) minmax(0, 1fr)" : "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <ReviewPanel token={token} ops={ops} onUnauthorized={onExpire} />
        <FeedbackPanel
          token={token}
          ops={feedbackOps}
          onUnauthorized={onExpire}
        />
        <ActivityPanel token={token} ops={auditOps} onUnauthorized={onExpire} />
      </div>
    </>
  );
}
