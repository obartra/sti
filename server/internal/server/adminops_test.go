package server

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/logring"
)

// The ops endpoints (doc 20): GET /admin/logs serves the in-process ring of
// recent log lines; POST /admin/restart audits, replies 202, and fires the
// process-level restart callback. Both sit behind the same bearer gate as
// every other admin endpoint.

// newOpsServer builds an admin-enabled server with a wired log ring and a spy
// restart callback, plus a logger whose records land in that ring.
func newOpsServer(t *testing.T) (http.Handler, *slog.Logger, chan struct{}, *Server) {
	t.Helper()
	ring := logring.New(100)
	restarted := make(chan struct{}, 1)
	srv, _ := newServer(t, Config{
		AdminEnabled:   true,
		AdminToken:     testAdminToken,
		AdminBurst:     1000,
		LogRing:        ring,
		RequestRestart: func() { restarted <- struct{}{} },
	}, nil)
	log := slog.New(logring.Tee(slog.NewJSONHandler(io.Discard, nil), ring))
	return srv.Handler(), log, restarted, srv
}

func getLogs(h http.Handler, query, bearer string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", contract.PathAdminLogs+query, nil)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	return do(h, req)
}

func TestAdminLogs(t *testing.T) {
	h, log, _, _ := newOpsServer(t)

	log.Info("listening", "addr", ":8080")
	log.Error("purge feedback", "err", "disk I/O error")

	// Unauthed never reaches the buffer.
	if rec := getLogs(h, "", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("logs no auth: %d, want 401", rec.Code)
	}

	// Authed: newest first, message + level + rendered attrs.
	rec := getLogs(h, "", testAdminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("logs: %d", rec.Code)
	}
	var got contract.AdminLogsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Entries) != 2 {
		t.Fatalf("want 2 entries, got %d", len(got.Entries))
	}
	first := got.Entries[0]
	if first.Msg != "purge feedback" || first.Level != "ERROR" || first.Attrs != "err=disk I/O error" {
		t.Fatalf("newest entry wrong: %+v", first)
	}

	// The level filter keeps only that level; limit caps the page.
	rec = getLogs(h, "?level=error", testAdminToken)
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Entries) != 1 || got.Entries[0].Level != "ERROR" {
		t.Fatalf("level filter wrong: %+v", got.Entries)
	}
	rec = getLogs(h, "?limit=1", testAdminToken)
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Entries) != 1 {
		t.Fatalf("limit=1 returned %d entries", len(got.Entries))
	}

	// A level outside the fixed set is a 400, not a silent empty list.
	if rec := getLogs(h, "?level=verbose", testAdminToken); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad level: %d, want 400", rec.Code)
	}
}

func TestAdminLogsWithoutRing(t *testing.T) {
	// A server with no ring wired (bare embedding) serves an empty list.
	srv, _ := newServer(t, Config{
		AdminEnabled: true,
		AdminToken:   testAdminToken,
		AdminBurst:   1000,
	}, nil)
	rec := getLogs(srv.Handler(), "", testAdminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("logs without ring: %d", rec.Code)
	}
	var got contract.AdminLogsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Entries) != 0 {
		t.Fatalf("want empty entries, got %d", len(got.Entries))
	}
}

func postRestart(h http.Handler, bearer string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", contract.PathAdminRestart, nil)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	return do(h, req)
}

func TestAdminRestart(t *testing.T) {
	h, _, restarted, srv := newOpsServer(t)
	ctx := context.Background()

	// Unauthed: rejected, no callback, no audit row.
	if rec := postRestart(h, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("restart no auth: %d, want 401", rec.Code)
	}
	select {
	case <-restarted:
		t.Fatal("unauthorized request fired the restart callback")
	default:
	}

	// Authed: 202, the callback fires, and the audit row landed first.
	if rec := postRestart(h, testAdminToken); rec.Code != http.StatusAccepted {
		t.Fatalf("restart: %d, want 202", rec.Code)
	}
	select {
	case <-restarted:
	case <-time.After(2 * time.Second):
		t.Fatal("restart callback never fired")
	}
	audits, err := srv.st.RecentAudits(ctx, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(audits) != 1 || audits[0].Action != "server.restart" {
		t.Fatalf("want one server.restart audit row, got %+v", audits)
	}
}

func TestAdminRestartWithoutCallback(t *testing.T) {
	// No RequestRestart wired: the endpoint is a 500 and nothing is audited
	// (restart is a process-level action only main.go can provide).
	srv, st := newServer(t, Config{
		AdminEnabled: true,
		AdminToken:   testAdminToken,
		AdminBurst:   1000,
	}, nil)
	if rec := postRestart(srv.Handler(), testAdminToken); rec.Code != http.StatusInternalServerError {
		t.Fatalf("restart without callback: %d, want 500", rec.Code)
	}
	if audits, _ := st.RecentAudits(context.Background(), 0, 10); len(audits) != 0 {
		t.Fatalf("nothing should be audited when restart is unavailable, got %+v", audits)
	}
}
