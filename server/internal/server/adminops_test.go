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
	"sti.care/api/internal/metrics"
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

// --- Error tracking + performance (doc 20) -----------------------------------

func getJSON[T any](t *testing.T, h http.Handler, path string) T {
	t.Helper()
	req := httptest.NewRequest("GET", path, nil)
	req.Header.Set("Authorization", "Bearer "+testAdminToken)
	rec := do(h, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: %d", path, rec.Code)
	}
	var out T
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestAdminErrorsAndPerf(t *testing.T) {
	srv, _ := newTestAdminSrv(t, testAdminToken)
	h := srv.Handler()

	// Seed one janitor error and a couple of requests through the real paths.
	srv.Metrics().Error(metrics.ErrJanitor)
	srv.Metrics().Observe("GET", "/healthz", 200, 0.0005)
	srv.Metrics().Observe("GET", "/healthz", 200, 10)

	// Unauthed reads never reach the data.
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminErrors, nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("errors no auth: %d, want 401", rec.Code)
	}
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminPerf, nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("perf no auth: %d, want 401", rec.Code)
	}

	errsResp := getJSON[contract.AdminErrorsResponse](t, h, contract.PathAdminErrors+"?days=7")
	if len(errsResp.Days) != 7 {
		t.Fatalf("want a zero-filled 7-day window, got %d", len(errsResp.Days))
	}
	today := errsResp.Days[len(errsResp.Days)-1]
	if today.Janitor != 1 || today.Store != 0 {
		t.Fatalf("today's bucket wrong: %+v", today)
	}
	totals := map[string]int64{}
	for _, e := range errsResp.Totals {
		totals[e.Type] = e.Count
	}
	if totals["janitor"] != 1 {
		t.Fatalf("lifetime totals wrong: %+v", errsResp.Totals)
	}

	perf := getJSON[contract.AdminPerfResponse](t, h, contract.PathAdminPerf+"?days=7")
	if len(perf.RequestsPerDay) != 7 {
		t.Fatalf("want 7 request days, got %d", len(perf.RequestsPerDay))
	}
	// The test's own admin calls flow through the observe middleware too, so
	// today's count is the 2 seeded plus however many reads ran before this one.
	if got := perf.RequestsPerDay[len(perf.RequestsPerDay)-1].Count; got < 2 {
		t.Fatalf("today's requests = %d, want at least the 2 seeded", got)
	}
	if len(perf.Latency) == 0 || perf.Latency[len(perf.Latency)-1].UnderMs != 0 {
		t.Fatalf("latency histogram missing its overflow bucket: %+v", perf.Latency)
	}
	// The fast bucket also collects the test's own admin reads; the overflow
	// holds exactly the one seeded 10s observation.
	if perf.Latency[0].Count < 1 || perf.Latency[len(perf.Latency)-1].Count != 1 {
		t.Fatalf("latency buckets wrong: %+v", perf.Latency)
	}
}

func TestAdminErrorsClear(t *testing.T) {
	srv, st := newTestAdminSrv(t, testAdminToken)
	h := srv.Handler()
	ctx := context.Background()
	srv.Metrics().Error(metrics.ErrStore)

	// Unauthed: rejected, nothing cleared, nothing audited.
	if rec := do(h, httptest.NewRequest("POST", "/admin/errors/clear", nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("clear no auth: %d, want 401", rec.Code)
	}

	req := httptest.NewRequest("POST", "/admin/errors/clear", nil)
	req.Header.Set("Authorization", "Bearer "+testAdminToken)
	if rec := do(h, req); rec.Code != http.StatusNoContent {
		t.Fatalf("clear: %d, want 204", rec.Code)
	}

	// Lifetime totals zeroed; the daily history (the record) stays.
	errsResp := getJSON[contract.AdminErrorsResponse](t, h, contract.PathAdminErrors+"?days=1")
	for _, e := range errsResp.Totals {
		if e.Count != 0 {
			t.Fatalf("totals not cleared: %+v", errsResp.Totals)
		}
	}
	if errsResp.Days[0].Store != 1 {
		t.Fatalf("daily history should survive clear: %+v", errsResp.Days[0])
	}

	audits, err := st.RecentAudits(ctx, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(audits) != 1 || audits[0].Action != "errors.clear" {
		t.Fatalf("want one errors.clear audit row, got %+v", audits)
	}
}

func TestAdminHealthGainsTodayAndBoxFacts(t *testing.T) {
	srv, _ := newServer(t, Config{
		AdminEnabled: true,
		AdminToken:   testAdminToken,
		AdminBurst:   1000,
		BuildVersion: "abc1234",
		DiskFree:     func() int64 { return 42 * 1024 * 1024 },
	}, nil)
	h := srv.Handler()
	srv.Metrics().Error(metrics.ErrDecode)

	got := getJSON[contract.AdminHealthResponse](t, h, contract.PathAdminHealth)
	todays := map[string]int64{}
	for _, e := range got.ErrorsToday {
		todays[e.Type] = e.Count
	}
	if todays["decode"] != 1 {
		t.Fatalf("errorsToday wrong: %+v", got.ErrorsToday)
	}
	if got.BuildVersion != "abc1234" || got.DiskFreeBytes != 42*1024*1024 {
		t.Fatalf("box facts missing: version=%q disk=%d", got.BuildVersion, got.DiskFreeBytes)
	}
	if got.UptimeSeconds < 0 {
		t.Fatalf("uptime negative: %d", got.UptimeSeconds)
	}
}
