package logring

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"testing"
)

// ringLogger builds a logger whose records land in the returned ring (and go
// nowhere else: the inner handler writes to io.Discard, like stdout in prod).
func ringLogger(capacity int) (*slog.Logger, *Ring) {
	r := New(capacity)
	h := Tee(slog.NewJSONHandler(io.Discard, nil), r)
	return slog.New(h), r
}

func TestRecentNewestFirst(t *testing.T) {
	log, r := ringLogger(10)
	log.Info("first")
	log.Warn("second")
	log.Error("third", "err", "boom")

	got := r.Recent(10, "")
	if len(got) != 3 {
		t.Fatalf("want 3 entries, got %d", len(got))
	}
	if got[0].Msg != "third" || got[1].Msg != "second" || got[2].Msg != "first" {
		t.Fatalf("not newest-first: %+v", got)
	}
	if got[0].Level != "ERROR" || got[0].Attrs != "err=boom" {
		t.Fatalf("level/attrs not captured: %+v", got[0])
	}
}

func TestCapacityWrapKeepsNewest(t *testing.T) {
	log, r := ringLogger(3)
	for _, m := range []string{"a", "b", "c", "d", "e"} {
		log.Info(m)
	}
	got := r.Recent(10, "")
	if len(got) != 3 {
		t.Fatalf("want capacity 3, got %d", len(got))
	}
	if got[0].Msg != "e" || got[1].Msg != "d" || got[2].Msg != "c" {
		t.Fatalf("oldest not dropped: %+v", got)
	}
}

func TestLevelFilterWalksPastOtherLevels(t *testing.T) {
	log, r := ringLogger(10)
	log.Error("bad one")
	for i := 0; i < 5; i++ {
		log.Info("noise")
	}
	log.Error("bad two")

	got := r.Recent(2, "ERROR")
	if len(got) != 2 {
		t.Fatalf("want 2 errors, got %d", len(got))
	}
	if got[0].Msg != "bad two" || got[1].Msg != "bad one" {
		t.Fatalf("filter wrong: %+v", got)
	}
}

func TestRecentLimitAndEmpty(t *testing.T) {
	log, r := ringLogger(10)
	if n := len(r.Recent(5, "")); n != 0 {
		t.Fatalf("empty ring should return 0 entries, got %d", n)
	}
	log.Info("one")
	log.Info("two")
	if n := len(r.Recent(1, "")); n != 1 {
		t.Fatalf("limit 1 should return 1 entry, got %d", n)
	}
	if n := len(r.Recent(0, "")); n != 0 {
		t.Fatalf("limit 0 should return 0 entries, got %d", n)
	}
}

func TestWithAttrsStillTees(t *testing.T) {
	log, r := ringLogger(10)
	log.With("sub", "janitor").Error("purge feedback", "err", "disk full")

	got := r.Recent(1, "")
	if len(got) != 1 {
		t.Fatalf("With-derived logger did not tee")
	}
	if got[0].Attrs != "sub=janitor err=disk full" {
		t.Fatalf("prefix attrs not rendered: %q", got[0].Attrs)
	}
}

func TestWithGroupStillTees(t *testing.T) {
	log, r := ringLogger(10)
	log.WithGroup("g").Info("grouped", "k", "v")
	got := r.Recent(1, "")
	if len(got) != 1 || got[0].Msg != "grouped" {
		t.Fatalf("WithGroup-derived logger did not tee: %+v", got)
	}
}

func TestConcurrentAppends(t *testing.T) {
	log, r := ringLogger(64)
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				log.Info("spin")
			}
		}()
	}
	wg.Wait()
	if n := len(r.Recent(64, "")); n != 64 {
		t.Fatalf("want a full ring of 64, got %d", n)
	}
}

func TestEnabledForwards(t *testing.T) {
	r := New(4)
	h := Tee(slog.NewJSONHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelWarn}), r)
	if h.Enabled(context.Background(), slog.LevelInfo) {
		t.Fatal("Enabled should defer to the inner handler's level")
	}
	if !h.Enabled(context.Background(), slog.LevelError) {
		t.Fatal("Enabled should allow levels the inner handler allows")
	}
}
