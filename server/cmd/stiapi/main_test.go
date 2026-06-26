package main

import (
	"encoding/hex"
	"errors"
	"strings"
	"testing"
)

// TestAdminConfig pins the boot-time admin floor (doc 20). Enabled with a token
// one char below the floor must error so a misconfigured deploy never exposes
// admin behind a weak token; enabled at the floor is ok; a token without the flag
// is inert (no error) and warns. Asserting the ERROR path means weakening
// adminTokenMinLen, or dropping the length check, turns this red.
func TestAdminConfig(t *testing.T) {
	// Pin the absolute floor, so LOWERING the constant (not just inverting the
	// check) turns this red. 32 chars is the doc-20 minimum for the admin bearer.
	if adminTokenMinLen != 32 {
		t.Fatalf("adminTokenMinLen = %d, want 32; the admin token floor must not be weakened", adminTokenMinLen)
	}

	below := strings.Repeat("x", adminTokenMinLen-1)
	atFloor := strings.Repeat("x", adminTokenMinLen)

	if _, _, err := adminConfig(true, below); !errors.Is(err, errAdminTokenFloor) {
		t.Fatalf("enabled + short token: want errAdminTokenFloor, got %v", err)
	}
	if _, _, err := adminConfig(true, ""); !errors.Is(err, errAdminTokenFloor) {
		t.Fatalf("enabled + empty token: want errAdminTokenFloor, got %v", err)
	}

	enabled, warn, err := adminConfig(true, atFloor)
	if err != nil {
		t.Fatalf("enabled + floor-length token: unexpected err %v", err)
	}
	if !enabled {
		t.Fatalf("enabled + floor-length token: want enabled=true")
	}
	if warn != "" {
		t.Fatalf("enabled + floor-length token: want no warn, got %q", warn)
	}

	// Token present but flag off: inert, no error, but a warn so the operator knows.
	enabled, warn, err = adminConfig(false, atFloor)
	if err != nil {
		t.Fatalf("token without flag: unexpected err %v", err)
	}
	if enabled {
		t.Fatalf("token without flag: want enabled=false (inert)")
	}
	if warn == "" {
		t.Fatalf("token without flag: want a warn signal")
	}

	// Neither set: inert, no error, no warn.
	if e, w, err := adminConfig(false, ""); e || w != "" || err != nil {
		t.Fatalf("neither set: want inert/no-warn/no-err, got %v/%q/%v", e, w, err)
	}
}

// TestNotifyGateWarning pins the two-gate notify decision (doc 10 §F): either gate
// alone delivers nothing and must warn; both agreeing is silent.
func TestNotifyGateWarning(t *testing.T) {
	if w := notifyGateWarning(true, false); w == "" {
		t.Errorf("flag on, no sender: want a warn")
	}
	if w := notifyGateWarning(false, true); w == "" {
		t.Errorf("sender set, flag off: want a warn")
	}
	if w := notifyGateWarning(true, true); w != "" {
		t.Errorf("both on: want no warn, got %q", w)
	}
	if w := notifyGateWarning(false, false); w != "" {
		t.Errorf("both off: want no warn, got %q", w)
	}
}

// TestDecoySecret pins the decoy-secret floor: empty and sub-32-byte values error,
// a >= 32-byte hex value decodes. Asserting the error path means weakening the
// floor turns this red.
func TestDecoySecret(t *testing.T) {
	if _, err := decoySecret(""); err == nil {
		t.Errorf("empty secret: want error")
	}
	if _, err := decoySecret("zznothex"); err == nil {
		t.Errorf("non-hex secret: want error")
	}
	// 31 bytes: one below the floor.
	short := hex.EncodeToString(make([]byte, 31))
	if _, err := decoySecret(short); err == nil {
		t.Errorf("31-byte secret: want error (below floor)")
	}
	// 32 bytes: at the floor.
	atFloor := hex.EncodeToString(make([]byte, 32))
	got, err := decoySecret(atFloor)
	if err != nil {
		t.Fatalf("32-byte secret: unexpected err %v", err)
	}
	if len(got) != 32 {
		t.Errorf("decoded length = %d, want 32", len(got))
	}
}
