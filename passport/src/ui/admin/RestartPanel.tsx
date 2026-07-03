import { useCallback, useEffect, useRef, useState } from "react";
import { PanelHeading } from "./panelChrome.tsx";
import { ConfirmButton } from "./ManagePanel.tsx";
import "./admin.css";
import type { AdminActionResult, AdminPingResult } from "./adminApi.ts";

// The restart control (doc 20): asks the service to drain and restart itself
// (an audited action; systemd brings it back a couple of seconds later), then
// pings until it answers again so the operator watches it come back instead of
// guessing. Uses the same deliberate second confirming click as the Manage
// actions: disruptive, and there is no queue context to check it against.

// The transport the panel needs, injected so tests and Storybook drive it
// without a server. `ping` is the same cheap token check the gate uses; here it
// doubles as the "is it back yet" probe.
export interface RestartOps {
  restart: (token: string) => Promise<AdminActionResult>;
  ping: (token: string) => Promise<AdminPingResult>;
}

const COPY = {
  title: "Restart the service",
  sub: "It finishes what it is doing, goes down for a couple of seconds, and comes back on its own. Every restart is recorded.",
  idle: "Restart",
  confirm: "Confirm: a few seconds of downtime.",
  waiting: "Restarting… this takes a few seconds.",
  back: "Back up.",
  actError: "That didn't go through. Try again.",
  timeout: "Still not back. Check the box.",
} as const;

// How often to probe while the service is down, and for how long before giving
// up (the box revives it after ~2s; 30s covers a slow drain with room).
const POLL_MS = 2000;
const MAX_PROBES = 15;

type Phase = "idle" | "waiting" | "back" | "timeout" | "actError";

export function RestartPanel({
  token,
  ops,
  onUnauthorized,
  onRestarted,
  pollMs = POLL_MS,
}: {
  token: string;
  ops: RestartOps;
  onUnauthorized: () => void;
  // Called once the service answers again, so the shell can refresh every
  // panel against the fresh process.
  onRestarted?: (() => void) | undefined;
  // Probe cadence, injectable so tests don't wait wall-clock seconds.
  pollMs?: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Probe until the service answers, the attempts run out, or the panel is
  // gone. A transport error while it is down is the expected case; only a
  // definite 401 means the token stopped being valid.
  const probe = useCallback(
    (attempt: number) => {
      if (!live.current) return;
      if (attempt > MAX_PROBES) {
        setPhase("timeout");
        return;
      }
      setTimeout(() => {
        void ops
          .ping(token)
          .then((r) => {
            if (!live.current) return;
            if (r === "ok") {
              setPhase("back");
              onRestarted?.();
            } else if (r === "unauthorized") {
              onUnauthorized();
            } else {
              probe(attempt + 1);
            }
          })
          .catch(() => probe(attempt + 1));
      }, pollMs);
    },
    [ops, token, onUnauthorized, onRestarted, pollMs],
  );

  const restart = useCallback(() => {
    setPhase("waiting");
    void ops
      .restart(token)
      .then((r) => {
        if (!live.current) return;
        if (r === "ok") probe(1);
        else if (r === "unauthorized") onUnauthorized();
        else setPhase("actError");
      })
      .catch(() => {
        if (live.current) setPhase("actError");
      });
  }, [ops, token, onUnauthorized, probe]);

  return (
    <section className="adm-panel">
      <PanelHeading title={COPY.title} sub={COPY.sub} />
      <div className="adm-item__actions">
        <ConfirmButton
          idle={COPY.idle}
          confirm={COPY.confirm}
          busy={phase === "waiting"}
          onConfirm={restart}
        />
      </div>
      {phase === "waiting" && <div className="adm-note">{COPY.waiting}</div>}
      {phase === "back" && <div className="adm-note">{COPY.back}</div>}
      {phase === "timeout" && <div className="adm-error">{COPY.timeout}</div>}
      {phase === "actError" && <div className="adm-error">{COPY.actError}</div>}
    </section>
  );
}
