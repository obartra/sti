package server

import (
	"context"

	"sti.care/api/internal/metrics"
	"sti.care/api/internal/store"
)

// Sender delivers a single contentless Web Push wake to one subscription. The
// payload carries nothing: a wake only tells the recipient's device to open the
// app and check, never who notified them or why. Implementations are gated off
// by default (Config.NotifyEnabled); the concrete Web Push (VAPID) adapter is
// wired separately and needs verification against a real push service.
type Sender interface {
	Send(ctx context.Context, t store.PushTarget) error
}

// drainBatch bounds how many due wakes one drain pass claims, so a backlog is
// worked down steadily rather than in one unbounded sweep.
const drainBatch = 256

// DrainSends delivers due contentless wakes through the configured Sender and
// removes each job once delivered. It is GATED OFF by default: with NotifyEnabled
// false (or no Sender) it is a no-op, and since handleNotify enqueues nothing
// while off, the queue stays empty. A job whose delivery fails is left queued so
// the next pass retries it; a job with no subscriptions is dropped (nobody to
// wake). Single-process: a job is read, delivered, then deleted, with no claim
// step, which is correct for the one background loop that calls this.
func (s *Server) DrainSends(ctx context.Context, now int64) {
	if !s.cfg.NotifyEnabled || s.sender == nil {
		return
	}
	sends, err := s.st.DueSends(ctx, now, drainBatch)
	if err != nil {
		s.metrics.Error(metrics.ErrJanitor)
		s.log.Error("due sends", "err", err)
		return
	}
	for _, snd := range sends {
		targets, err := s.st.PushEndpoints(ctx, snd.RoutingEndpointID)
		if err != nil {
			// Leave the job queued; a later pass retries once the read recovers.
			s.metrics.Error(metrics.ErrJanitor)
			s.log.Error("push endpoints", "err", err)
			continue
		}
		delivered := true
		for _, t := range targets {
			if err := s.sender.Send(ctx, t); err != nil {
				delivered = false
				s.metrics.Error(metrics.ErrJanitor)
				s.log.Error("push send", "err", err)
			}
		}
		// Delete only on a clean pass (no subscriptions counts as clean: there is
		// nobody to wake). A partial/failed delivery keeps the job, so the next
		// pass re-sends ALL of its targets, including any that already succeeded.
		// A duplicate contentless wake ("open the app and check") is idempotent
		// and leaks nothing, so at-least-once beats dropping a wake on a flake.
		if delivered {
			if err := s.st.DeleteSend(ctx, snd.ID); err != nil {
				s.metrics.Error(metrics.ErrJanitor)
				s.log.Error("delete send", "err", err)
			}
		}
	}
}
