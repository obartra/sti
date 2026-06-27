package server

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"testing"

	"sti.care/api/internal/store"
)

// rampSecret is the deterministic 32-byte decoy secret every server test uses
// (bytes 1..32). Built fresh per call so no test can mutate another's copy.
func rampSecret() []byte {
	s := make([]byte, 32)
	for i := range s {
		s[i] = byte(i + 1)
	}
	return s
}

// openTestStore opens a SQLite store in a per-test temp dir and closes it on
// cleanup. The store half of every server-test constructor.
func openTestStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

// newServer builds a test Server over a fresh store with the given config and
// clock (nil = real time), discarding logs. DecoySecret defaults to rampSecret()
// when the caller leaves it unset. Returns the server and its store; callers that
// only want the handler call srv.Handler(). The one test that inspects emitted
// logs (metrics) wires its own buffer-backed logger instead of using this.
func newServer(t *testing.T, cfg Config, clock func() int64) (*Server, *store.Store) {
	t.Helper()
	st := openTestStore(t)
	if cfg.DecoySecret == nil {
		cfg.DecoySecret = rampSecret()
	}
	srv := New(st, cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), clock)
	return srv, st
}
