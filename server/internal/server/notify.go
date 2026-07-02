package server

import (
	"context"
	"errors"
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

// drainBatch bounds how many due jobs one drain pass claims, so a backlog is
// worked down steadily rather than in one unbounded sweep.
const drainBatch = 256

// DrainSends advances the wake pipeline (doc 13 §2). With NotifyEnabled false it is
// a no-op, and since handleNotify enqueues nothing while off, both queues stay empty.
//
// The cover broadcast is a SCHEDULED heartbeat, not a reaction to real activity. On a
// fixed wall-clock cadence (CoverHeartbeat) the drain fires one population-wide
// contentless cover broadcast whether or not any real wake is pending. Because the
// schedule is constant, the mere EXISTENCE and TIMING of a broadcast carries no
// information about whether anyone reported: a quiet period and a busy period emit the
// identical heartbeat. Real due-sends simply ride the next heartbeat as anonymous
// members of the population; they no longer trigger their own broadcast.
//
// This drain does three things, in order:
//
//	scrubDueSends: consume the real wake jobs so send_queue stays bounded. A real job
//	no longer decides whether a broadcast happens, so it is just dropped; its recipient
//	is a registered push route and is woken by the next heartbeat like everyone else.
//	This is also the fail-closed reclaim when no Sender is configured.
//
//	fanOutHeartbeat (only when a heartbeat is due AND a Sender exists): schedule one
//	cover wake per registered push route, each jittered inside CoverWindow.
//
//	deliverCovers (only with a Sender): deliver cover wakes whose time has arrived.
//
// With intake on but NO Sender configured, scrubDueSends still reclaims the queued real
// jobs (so send_queue can never grow unbounded), but no heartbeat covers are emitted
// (there is no transport to deliver) and deliverCovers is skipped so s.sender is never
// dereferenced nil. A box with no keys wakes no one.
//
// Single-process: read, deliver, delete, with no claim step, which is correct for the
// one background loop that calls this. The heartbeat cursor (heartbeatDue) is likewise
// touched only by that single loop, so it needs no lock.
func (s *Server) DrainSends(ctx context.Context, now int64) {
	if !s.cfg.NotifyEnabled {
		return
	}
	// Real due-sends are consumed but no longer trigger anything. Removing the old
	// anyReal broadcast trigger is what makes a junk/unregistered token wake nobody
	// ever: broadcasts are purely scheduled, so a probe cannot buy a broadcast at any
	// price. This runs with or without a Sender, so the queue is always reclaimed.
	s.scrubDueSends(ctx, now)
	if s.sender == nil {
		// Intake is on but no Web Push transport is configured, so a cover broadcast
		// could never be delivered. Emit none and never dereference the nil sender; the
		// queue was already reclaimed above.
		return
	}
	// Scheduled decoy heartbeat: fire a population-wide cover broadcast on the fixed
	// wall-clock cadence, independent of real activity, so its timing leaks nothing.
	if s.heartbeatDue(now) {
		s.fanOutHeartbeat(ctx, now)
	}
	s.deliverCovers(ctx, now)
}

// heartbeatDue reports whether a scheduled cover broadcast is due at now, advancing
// the internal cursor when it is. The schedule is the fixed wall-clock grid of
// CoverHeartbeat-sized slots measured from the epoch: a broadcast fires at most once
// per slot boundary crossed, at instants that depend ONLY on the wall clock and the
// configured cadence, never on when the process started or whether a real wake is
// pending. That constancy is the whole point: an observer of the broadcast learns
// nothing about who reported or when, because the same heartbeat fires in a silent
// window as in a busy one.
//
// The first drain after boot only seeds the cursor (it does not fire), so a restart
// never emits an off-grid broadcast whose timing an observer could correlate with the
// restart; the next broadcast still lands on the same grid boundary two identically
// configured servers would use. A stalled loop that skips several slots fires once and
// jumps to the current slot rather than replaying every missed beat, keeping the
// broadcast bounded.
//
// A non-positive cadence disables the heartbeat (no broadcasts); withDefaults keeps the
// production value positive, so this is only reachable by a test constructing Config
// directly.
func (s *Server) heartbeatDue(now int64) bool {
	hb := s.cfg.CoverHeartbeat.Milliseconds()
	if hb <= 0 {
		return false
	}
	slot := now / hb
	if !s.coverSlotSet {
		s.coverSlotSet = true
		s.lastCoverSlot = slot
		return false
	}
	if slot != s.lastCoverSlot {
		s.lastCoverSlot = slot
		return true
	}
	return false
}

// scrubDueSends consumes every due real wake job. A real wake no longer fans out its
// own broadcast (the cover broadcast is scheduled, see DrainSends), so its only
// remaining job here is to be reclaimed, bounding send_queue. The recipient is a
// registered push route and is woken by the next scheduled heartbeat as one anonymous
// member of the population. A read error leaves the jobs queued for the next pass; a
// per-row delete hiccup is logged, not fatal (deleteAll reclaims it later). The batch
// cap bounds one pass so a backlog is worked down steadily.
func (s *Server) scrubDueSends(ctx context.Context, now int64) {
	real, err := s.st.DueSends(ctx, now, drainBatch)
	if err != nil {
		s.metrics.Error(metrics.ErrJanitor)
		s.log.Error("due sends", "err", err)
		return
	}
	s.deleteAll(ctx, real)
}

// fanOutHeartbeat schedules one contentless cover wake per registered push route, each
// at an independently jittered instant inside CoverWindow so the broadcast is a smear,
// not a synchronized burst. Every cover is byte-identical: there is no real-vs-decoy
// field, so a heartbeat cover is indistinguishable from the covers a real-triggered
// broadcast used to produce. An empty population is a clean no-op (nobody to wake).
//
// A store error (reading the routes, or enqueuing a cover) is logged and ends the pass:
// the missed routes simply catch the next scheduled heartbeat. This never crashes the
// drain loop, and because the schedule is fixed the partial result carries no timing
// signal about real activity.
func (s *Server) fanOutHeartbeat(ctx context.Context, now int64) {
	routes, err := s.st.DistinctPushRoutes(ctx)
	if err != nil {
		s.metrics.Error(metrics.ErrJanitor)
		s.log.Error("cover routes", "err", err)
		return
	}
	window := s.cfg.CoverWindow.Milliseconds()
	for _, route := range routes {
		// Jitter each cover independently across the window so the broadcast is a
		// smear, not a synchronized burst. Window 0 (tests) or any non-positive value
		// fires now; the guard mirrors the republish jitter so neither path can panic
		// rand.Int64N on a non-positive bound.
		at := now
		if window > 0 {
			at += rand.Int64N(window + 1)
		}
		if err := s.st.EnqueueCover(ctx, route, at, now); err != nil {
			s.metrics.Error(metrics.ErrJanitor)
			s.log.Error("enqueue cover", "err", err)
			return
		}
	}
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
			err := s.sender.Send(ctx, t)
			if err == nil {
				continue
			}
			if errors.Is(err, ErrSubscriptionGone) {
				// A permanently dead subscription (the push service returned 404/410):
				// prune it so it stops inflating every future cover broadcast and is
				// never retried. Not counted as a delivery failure, retrying a gone
				// endpoint can only fail again, so it must not pin the cover for retry.
				if derr := s.st.DeletePushEndpoint(ctx, cover.RoutingEndpointID, t.Endpoint); derr != nil {
					s.metrics.Error(metrics.ErrJanitor)
					s.log.Error("prune dead push endpoint", "err", derr)
				}
				continue
			}
			delivered = false
			s.metrics.Error(metrics.ErrJanitor)
			s.log.Error("push send", "err", err)
		}
		if delivered {
			if err := s.st.DeleteCover(ctx, cover.ID); err != nil {
				s.metrics.Error(metrics.ErrJanitor)
				s.log.Error("delete cover", "err", err)
			}
		}
	}
}
