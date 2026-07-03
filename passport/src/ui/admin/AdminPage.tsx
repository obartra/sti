import { useCallback, useEffect, useState } from "react";
import { Button, Field, Input } from "../../design/components/index.ts";
import { Lock } from "../../design/icons.tsx";
import "./admin.css";
import { pingAdmin, type AdminPingResult } from "./adminApi.ts";
import {
  clearAdminToken,
  readAdminToken,
  saveAdminToken,
} from "./adminToken.ts";
import { AuthedShell, type AdminTab } from "./AuthedShell.tsx";
import { useAdminTransports } from "./adminTransports.ts";
import type { ReviewOps } from "./ReviewPanel.tsx";
import type { AuditOps } from "./ActivityPanel.tsx";
import type { MetricsOps } from "./MetricsPanel.tsx";
import type { HealthOps } from "./HealthPanel.tsx";
import type { FeedbackOps } from "./FeedbackPanel.tsx";
import type { ManageOps } from "./ManagePanel.tsx";
import type { LogsOps } from "./LogsPanel.tsx";
import type { RestartOps } from "./RestartPanel.tsx";
import type { ErrorsOps } from "./ErrorsPanel.tsx";

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
   * Service-health transport (doc 20). Defaults to the real health endpoint bound to
   * apiBase; injectable so tests and Storybook drive the panel without a server.
   */
  healthOps?: HealthOps;
  /**
   * "Something wrong?" review transport (doc 35). Defaults to the real feedback
   * endpoints bound to apiBase; injectable so tests and Storybook drive it.
   */
  feedbackOps?: FeedbackOps;
  /**
   * Account / alias management transport (A3). Defaults to the real lookup / disable
   * / revoke endpoints bound to apiBase; injectable so tests and Storybook drive it.
   */
  manageOps?: ManageOps;
  /**
   * Server-log transport (doc 20). Defaults to the real logs endpoint bound to
   * apiBase; injectable so tests and Storybook drive it.
   */
  logsOps?: LogsOps;
  /**
   * Restart transport (doc 20): the audited restart plus the ping probe that
   * watches the service come back. Injectable like the rest.
   */
  restartOps?: RestartOps;
  /**
   * Error-tracking transport (doc 20): the per-day buckets, the ERROR-level
   * log lines, and the audited clear. Injectable like the rest.
   */
  errorsOps?: ErrorsOps;
  /**
   * Which console section opens first once authed (default the overview).
   * Stories use it to capture each tab.
   */
  initialTab?: AdminTab;
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
  healthOps,
  feedbackOps,
  manageOps,
  logsOps,
  restartOps,
  errorsOps,
  initialTab,
}: AdminPageProps) {
  const validate = useCallback(
    (token: string) => (ping ? ping(token) : pingAdmin(apiBase, token)),
    [ping, apiBase],
  );
  const transports = useAdminTransports(apiBase, {
    reviewOps,
    auditOps,
    metricsOps,
    healthOps,
    feedbackOps,
    manageOps,
    logsOps,
    restartOps,
    errorsOps,
  });
  const { phase, token, setToken, error, onSubmit, lock, expire } =
    useAdminGate(validate);

  // Admin bypasses the app's Chrome (it is an isolated takeover), so it owns its
  // own centered page frame rather than inheriting the consumer shell's. The authed
  // console spreads its panels across the desktop width; the lock gate stays a
  // compact, centered sign-in.
  const innerClass =
    phase === "authed"
      ? "adm-page__inner adm-page__inner--authed"
      : "adm-page__inner";
  return (
    <div className="adm-page">
      <div className={innerClass}>
        {phase === "authed" ? (
          <AuthedShell
            token={token}
            ops={transports.ops}
            auditOps={transports.audit}
            metricsOps={transports.metrics}
            healthOps={transports.health}
            feedbackOps={transports.feedback}
            manageOps={transports.manage}
            logsOps={transports.logs}
            restartOps={transports.restart}
            errorsOps={transports.errors}
            onLock={lock}
            onExpire={expire}
            initialTab={initialTab}
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
    <div className="adm-gate">
      <div className="adm-gate__head">
        <span className="adm-gate__mark">
          <Lock size={18} />
        </span>
        <div>
          <div className="adm-gate__title">{COPY.lockTitle}</div>
          <div className="adm-gate__sub">{COPY.lockSub}</div>
        </div>
      </div>
      <form onSubmit={onSubmit} className="adm-gate__form">
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
    </div>
  );
}
