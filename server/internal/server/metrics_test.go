package server

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

// newInstrumented returns a Server (not just its Handler) plus the buffer its
// slog writes to, so a test can scrape metrics and inspect log output.
func newInstrumented(t *testing.T) (*Server, *store.Store, *bytes.Buffer) {
	t.Helper()
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	secret := make([]byte, 32)
	for i := range secret {
		secret[i] = byte(i + 1)
	}
	var logBuf bytes.Buffer
	srv := New(st, Config{DecoySecret: secret}, slog.New(slog.NewTextHandler(&logBuf, nil)), nil)
	return srv, st, &logBuf
}

func scrapeMetrics(t *testing.T, srv *Server) string {
	t.Helper()
	rec := httptest.NewRecorder()
	srv.Metrics().Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/metrics", nil))
	return rec.Body.String()
}

// End to end: a real alias hit and a real miss both flow through the handler and
// land on one 2xx /a series, and NO concrete id appears in the scrape.
func TestServerMetricsExistenceUniformNoLeak(t *testing.T) {
	srv, _, _ := newInstrumented(t)
	h := srv.Handler()

	hitID := randID(t)
	payload := bytes.Repeat([]byte{0xAB}, contract.AliasPayloadSize)
	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+hitID, bytes.NewReader(payload))
	put.Header.Set(contract.HeaderWriteToken, "owner-token")
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}

	missID := randID(t)
	do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+hitID, nil))  // hit
	do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+missID, nil)) // miss

	out := scrapeMetrics(t, srv)
	for _, id := range []string{hitID, missID} {
		if strings.Contains(out, id) {
			t.Fatalf("scrape leaked an id %q:\n%s", id, out)
		}
	}
	if !strings.Contains(out, `sti_requests_total{endpoint="/a/{id}",method="GET",status_class="2xx"} 2`) {
		t.Errorf("hit and miss should share one 2xx series:\n%s", out)
	}
}

// A store error on the hot read increments errors_total{type="store"} and the
// log line for it must not contain the id (doc 12 §4 rule 3).
func TestServerStoreErrorCountedAndLogScrubbed(t *testing.T) {
	srv, st, logBuf := newInstrumented(t)
	id := randID(t)
	// Force every store read to error by closing the database underneath.
	if err := st.Close(); err != nil {
		t.Fatal(err)
	}

	rec := do(srv.Handler(), httptest.NewRequest("GET", contract.PathAliasPrefix+id, nil))
	if rec.Code != http.StatusOK || rec.Body.Len() != contract.AliasPayloadSize {
		t.Fatalf("a store error must still return a uniform decoy: code=%d len=%d", rec.Code, rec.Body.Len())
	}

	out := scrapeMetrics(t, srv)
	if !strings.Contains(out, `sti_errors_total{type="store"} 1`) {
		t.Errorf("expected one store error counted:\n%s", out)
	}
	if logs := logBuf.String(); strings.Contains(logs, id) {
		t.Fatalf("error log leaked the id %q:\n%s", id, logs)
	}
}

// The metrics endpoint is text-format and reachable; the public Handler must not
// serve /metrics (it is a separate loopback listener in main).
func TestMetricsNotOnPublicMux(t *testing.T) {
	srv, _, _ := newInstrumented(t)
	rec := do(srv.Handler(), httptest.NewRequest("GET", "/metrics", nil))
	if rec.Code == http.StatusOK && strings.Contains(rec.Body.String(), "sti_requests_total") {
		t.Fatalf("/metrics must not be served by the public handler")
	}
}
