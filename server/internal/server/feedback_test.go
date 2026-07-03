package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"sti.care/api/internal/contract"
)

func postFeedback(h http.Handler, reason, body string) *httptest.ResponseRecorder {
	return postFeedbackTopic(h, reason, "", body)
}

func postFeedbackTopic(h http.Handler, reason, topic, body string) *httptest.ResponseRecorder {
	b, _ := json.Marshal(contract.FeedbackRequest{Reason: reason, Topic: topic, Body: body})
	return do(h, httptest.NewRequest("POST", contract.PathFeedback, bytes.NewReader(b)))
}

// A well-formed "Something wrong?" report is accepted (202) and stored with its note
// intact; a note is optional; an unknown category and an over-length note are 400 and
// store nothing (doc 35).
func TestFeedbackIntake(t *testing.T) {
	srv, st := newServer(t, Config{}, func() int64 { return 1_000 })
	h := srv.Handler()
	ctx := context.Background()

	if rec := postFeedback(h, contract.FeedbackBroken, "share button does nothing"); rec.Code != http.StatusAccepted {
		t.Fatalf("valid: %d, want 202", rec.Code)
	}
	got, _ := st.OpenFeedback(ctx, 10)
	if len(got) != 1 || got[0].Reason != contract.FeedbackBroken || got[0].Body != "share button does nothing" {
		t.Fatalf("not recorded: %+v", got)
	}

	// The note is optional.
	if rec := postFeedback(h, contract.FeedbackConfusing, ""); rec.Code != http.StatusAccepted {
		t.Fatalf("empty note: %d, want 202", rec.Code)
	}
	// A suggestion is accepted like any other category.
	if rec := postFeedback(h, contract.FeedbackIdea, "a search box would help"); rec.Code != http.StatusAccepted {
		t.Fatalf("idea: %d, want 202", rec.Code)
	}
	// An open-question response carries a fixed topic code, stored with the row.
	if rec := postFeedbackTopic(h, contract.FeedbackQuestion, "groups", "groups feel caring, not sorting"); rec.Code != http.StatusAccepted {
		t.Fatalf("question: %d, want 202", rec.Code)
	}
	if got, _ := st.OpenFeedback(ctx, 1); len(got) != 1 || got[0].Topic != "groups" {
		t.Fatalf("topic not stored: %+v", got)
	}
	// An unknown topic is rejected like an unknown category.
	if rec := postFeedbackTopic(h, contract.FeedbackQuestion, "nonsense", "x"); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad topic: %d, want 400", rec.Code)
	}
	// An unknown category is rejected.
	if rec := postFeedback(h, "nonsense", "x"); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad reason: %d, want 400", rec.Code)
	}
	// An over-length note is rejected (the one free-text field is capped).
	long := strings.Repeat("a", contract.FeedbackBodyMaxRunes+1)
	if rec := postFeedback(h, contract.FeedbackOther, long); rec.Code != http.StatusBadRequest {
		t.Fatalf("too long: %d, want 400", rec.Code)
	}

	if n, _ := st.OpenFeedbackCount(ctx); n != 4 {
		t.Fatalf("stored count = %d, want 4 (only the four valid reports)", n)
	}
}

// Intake is rate-limited: the per-IP burst is the tightest bucket, so once it is
// spent the next report is turned away with a uniform 429 (doc 35).
func TestFeedbackIntakeRateLimited(t *testing.T) {
	srv, _ := newServer(t, Config{}, func() int64 { return 1_000 })
	h := srv.Handler()

	for i := 0; i < 20; i++ { // default IP burst
		if rec := postFeedback(h, contract.FeedbackOther, ""); rec.Code != http.StatusAccepted {
			t.Fatalf("req %d: %d, want 202", i, rec.Code)
		}
	}
	if rec := postFeedback(h, contract.FeedbackOther, ""); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("over burst: %d, want 429", rec.Code)
	}
}
