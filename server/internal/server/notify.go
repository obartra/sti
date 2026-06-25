package server

import (
	"context"
	"math/rand/v2"

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

// DrainSends advances the two-stage wake pipeline (doc 13 §2). It is GATED OFF by
// default: with NotifyEnabled false (or no Sender) it is a no-op, and since
// handleNotify enqueues nothing while off, both queues stay empty.
//
// Stage 1 (fanOutCover): a real wake coming due never goes to its recipient
// directly. Instead it fans out one cover wake per registered push route into the
// cover queue, each at a jittered time inside CoverWindow, then drops the real
// job. The recipient is woken only as one anonymous member of that broadcast.
//
// Stage 2 (deliverCovers): cover wakes whose time has arrived are delivered
// contentlessly and removed. Failed deliveries are retained for the next pass.
//
// Single-process: read, deliver, delete, with no claim step, which is correct for
// the one background loop that calls this.
func (s *Server) DrainSends(ctx context.Context, now int64) {
	if !s.cfg.NotifyEnabled || s.sender == nil {
		return
	}
	s.fanOutCover(ctx, now)
	s.deliverCovers(ctx, now)
}

// fanOutCover turns every due real wake into a population-wide cover broadcast.
// If scheduling the broadcast fails, the real jobs are left queued so a later pass
// retries; a real wake is dropped only once its covers are safely scheduled (or
// there is no one to wake at all, which is itself a clean drop).
//
// Each queued send carries the notify TOKEN HASH (handleNotify enqueues it without
// looking it up, so the request path is constant-time). Here, off the request path,
// we resolve it: a broadcast fires only if at least one due token maps to a real
// registered route. Unknown tokens (probes, or a token whose device never
// registered push) trigger no broadcast and are simply dropped, so the constant-time
// intake cannot be turned into a cheap way to wake the whole population.
func (s *Server) fanOutCover(ctx context.Context, now int64) {
	real, err := s.st.DueSends(ctx, now, drainBatch)
	if err != nil {
		s.metrics.Error(metrics.ErrJanitor)
		s.log.Error("due sends", "err", err)
		return
	}
	if len(real) == 0 {
		return
	}
	anyReal, err := s.anyResolves(ctx, real)
	if err != nil {
		// A transient read failure: leave the jobs queued and retry next pass.
		s.metrics.Error(metrics.ErrStore)
		s.log.Error("resolve notify token", "err", err)
		return
	}
	if !anyReal {
		// All due tokens are unknown: nothing to wake. Drop them without broadcasting.
		s.deleteAll(ctx, real)
		return
	}
	routes, err := s.st.DistinctPushRoutes(ctx)
	if err != nil {
		// Leave the real jobs queued; without the population we cannot fan out.
		s.metrics.Error(metrics.ErrJanitor)
		s.log.Error("cover routes", "err", err)
		return
	}
	for _, route := range routes {
		// Jitter each cover independently across the window so the broadcast is a
		// smear, not a synchronized burst. Window 0 means fire now (used in tests).
		at := now + rand.Int64N(int64(s.cfg.CoverWindow.Milliseconds())+1)
		if err := s.st.EnqueueCover(ctx, route, at, now); err != nil {
			// A partial fan-out: leave the real jobs queued so the next pass redoes
			// the whole broadcast. Duplicate contentless wakes are harmless.
			s.metrics.Error(metrics.ErrJanitor)
			s.log.Error("enqueue cover", "err", err)
			return
		}
	}
	// The broadcast is scheduled (or there were no push routes, nobody to wake), so
	// the real jobs have served their only purpose: triggering it. Drop them.
	s.deleteAll(ctx, real)
}

// anyResolves reports whether any queued send's token hash maps to a registered
// notify route. A read error is returned so the caller can retry rather than
// silently treating a transient failure as "no real wake".
func (s *Server) anyResolves(ctx context.Context, sends []store.Send) (bool, error) {
	for _, snd := range sends {
		_, found, err := s.st.GetNotifyRoute(ctx, snd.RoutingEndpointID)
		if err != nil {
			return false, err
		}
		if found {
			return true, nil
		}
	}
	return false, nil
}

// deleteAll drops every queued send by id, logging (not failing) on a hiccup: a
// leftover row is reclaimed on the next pass, never delivered twice.
func (s *Server) deleteAll(ctx context.Context, sends []store.Send) {
	for _, snd := range sends {
		if err := s.st.DeleteSend(ctx, snd.ID); err != nil {
			s.metrics.Error(metrics.ErrJanitor)
			s.log.Error("delete send", "err", err)
		}
	}
}

// deliverCovers sends every due cover wake and removes it on a clean pass. A
// partial/failed delivery keeps the job, so the next pass re-sends ALL of its
// targets; a duplicate contentless wake ("open the app and check") is idempotent
// and leaks nothing, so at-least-once beats dropping a wake on a flake. A route
// with no subscriptions counts as clean (nobody to wake).
func (s *Server) deliverCovers(ctx context.Context, now int64) {
	covers, err := s.st.DueCovers(ctx, now, drainBatch)
	if err != nil {
		s.metrics.Error(metrics.ErrJanitor)
		s.log.Error("due covers", "err", err)
		return
	}
	for _, cover := range covers {
		targets, err := s.st.PushEndpoints(ctx, cover.RoutingEndpointID)
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
		if delivered {
			if err := s.st.DeleteCover(ctx, cover.ID); err != nil {
				s.metrics.Error(metrics.ErrJanitor)
				s.log.Error("delete cover", "err", err)
			}
		}
	}
}
