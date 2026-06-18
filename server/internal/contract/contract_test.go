package contract

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestIDEncodedLenMatchesEntropy(t *testing.T) {
	got := base64.RawURLEncoding.EncodedLen(IDRandomBytes)
	if got != IDEncodedLen {
		t.Fatalf("IDEncodedLen = %d, but base64url(%d bytes) encodes to %d", IDEncodedLen, IDRandomBytes, got)
	}
}

func TestValidID(t *testing.T) {
	valid := base64.RawURLEncoding.EncodeToString(make([]byte, IDRandomBytes))
	cases := []struct {
		name string
		id   string
		want bool
	}{
		{"well formed", valid, true},
		{"empty", "", false},
		{"too short", "abc", false},
		{"too long", valid + "A", false},
		{"standard base64 padding rejected", valid[:41] + "==", false},
		{"slash rejected (not url-safe)", "/" + valid[1:], false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ValidID(c.id); got != c.want {
				t.Fatalf("ValidID(%q) = %v, want %v", c.id, got, c.want)
			}
		})
	}
}

// The knock response is the load-bearing existence-uniform value: it must be one
// fixed shape, identical for every id. Pin it as a golden string.
func TestKnockResponseGolden(t *testing.T) {
	b, err := json.Marshal(KnockResponse{Status: KnockStatus})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(b), `{"status":"received"}`; got != want {
		t.Fatalf("knock response = %s, want %s", got, want)
	}
}

func TestErrorResponseGolden(t *testing.T) {
	b, err := json.Marshal(ErrorResponse{Error: ErrorBody{Code: ErrRateLimited, Message: "slow down"}})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(b), `{"error":{"code":"rate_limited","message":"slow down"}}`; got != want {
		t.Fatalf("error response = %s, want %s", got, want)
	}
}

func TestNotifyRequestRoundTrip(t *testing.T) {
	in := NotifyRequest{TokenHash: "deadbeef"}
	b, err := json.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}
	var out NotifyRequest
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if out != in {
		t.Fatalf("round-trip = %+v, want %+v", out, in)
	}
}

func TestSizesAreSane(t *testing.T) {
	if AliasPayloadSize <= 0 {
		t.Fatal("AliasPayloadSize must be positive (it is the fixed wire size of every alias read)")
	}
	if AccountBlobMaxSize < AliasPayloadSize {
		t.Fatal("AccountBlobMaxSize should be at least AliasPayloadSize")
	}
}
