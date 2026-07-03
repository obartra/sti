// Package logring keeps the service's most recent log lines in memory so the
// admin surface can show them (doc 20) without granting the hardened service
// user any journal access. A slog handler tee captures every record on its way
// to stdout; the ring holds a fixed number of recent entries and drops the
// oldest. The buffer lives in the process, so it starts empty on every boot;
// the systemd journal on the box stays the deep archive.
//
// Blind by construction: doc 12 §4 bounds what a log line may carry (a static
// message, a numeric count, an err value, a config string at startup), so an
// entry never holds an id, token, IP, or user-typed text. This package renders
// records as-is and must never widen that rule.
package logring

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
)

// Entry is one captured log line: the instant, the level, the fixed message,
// and the record's attributes rendered "k=v", space-joined.
type Entry struct {
	At    int64  // unix milliseconds
	Level string // DEBUG | INFO | WARN | ERROR
	Msg   string
	Attrs string
}

// Ring is a fixed-capacity, mutex-guarded circular buffer of recent entries.
type Ring struct {
	mu   sync.Mutex
	buf  []Entry
	next int  // index the next entry lands in
	full bool // the buffer has wrapped at least once
}

// New returns a ring holding up to capacity entries (minimum 1).
func New(capacity int) *Ring {
	if capacity < 1 {
		capacity = 1
	}
	return &Ring{buf: make([]Entry, capacity)}
}

func (r *Ring) add(e Entry) {
	r.mu.Lock()
	r.buf[r.next] = e
	r.next = (r.next + 1) % len(r.buf)
	if r.next == 0 {
		r.full = true
	}
	r.mu.Unlock()
}

// Recent returns up to limit entries, newest first. A non-empty level keeps
// only entries at exactly that level (e.g. "ERROR"); the limit applies after
// the filter, so asking for 50 errors walks past interleaved info lines.
func (r *Ring) Recent(limit int, level string) []Entry {
	if limit < 1 {
		return []Entry{}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	size := r.next
	if r.full {
		size = len(r.buf)
	}
	out := make([]Entry, 0, min(limit, size))
	for i := 0; i < size && len(out) < limit; i++ {
		e := r.buf[(r.next-1-i+len(r.buf))%len(r.buf)]
		if level != "" && e.Level != level {
			continue
		}
		out = append(out, e)
	}
	return out
}

// teeHandler forwards every record to the wrapped handler unchanged and also
// appends it to the ring, so stdout (and the journal behind it) stays the
// primary sink and the ring is a pure observer.
type teeHandler struct {
	inner  slog.Handler
	ring   *Ring
	prefix []slog.Attr // attrs bound via WithAttrs, rendered into every entry
}

// Tee wraps inner so every record it handles is also captured in ring.
func Tee(inner slog.Handler, ring *Ring) slog.Handler {
	return &teeHandler{inner: inner, ring: ring}
}

func (h *teeHandler) Enabled(ctx context.Context, l slog.Level) bool {
	return h.inner.Enabled(ctx, l)
}

func (h *teeHandler) Handle(ctx context.Context, rec slog.Record) error {
	var b strings.Builder
	for _, a := range h.prefix {
		appendAttr(&b, a)
	}
	rec.Attrs(func(a slog.Attr) bool {
		appendAttr(&b, a)
		return true
	})
	h.ring.add(Entry{
		At:    rec.Time.UnixMilli(),
		Level: rec.Level.String(),
		Msg:   rec.Message,
		Attrs: b.String(),
	})
	return h.inner.Handle(ctx, rec)
}

func (h *teeHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	prefix := make([]slog.Attr, 0, len(h.prefix)+len(attrs))
	prefix = append(append(prefix, h.prefix...), attrs...)
	return &teeHandler{inner: h.inner.WithAttrs(attrs), ring: h.ring, prefix: prefix}
}

func (h *teeHandler) WithGroup(name string) slog.Handler {
	// The codebase logs no groups; the inner handler keeps the grouping and the
	// ring flattens it (group names are dropped from the rendered attrs).
	return &teeHandler{inner: h.inner.WithGroup(name), ring: h.ring, prefix: h.prefix}
}

func appendAttr(b *strings.Builder, a slog.Attr) {
	if b.Len() > 0 {
		b.WriteByte(' ')
	}
	fmt.Fprintf(b, "%s=%v", a.Key, a.Value)
}
