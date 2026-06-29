package main

import (
	"encoding/base64"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

// addMissing fills in keys the box has but the store lacks, and must never clobber a
// value already staged locally, so adopting an existing box leaves a staged edit
// (here the VAPID public key) intact and a later diff shows only that change.
func TestAddMissing(t *testing.T) {
	store := storeHeader + "\nSTI_VAPID_PUBLIC_KEY=local-edit\n"
	remote := map[string]string{
		"STI_VAPID_PUBLIC_KEY": "box-value", // already staged locally; must be kept
		"STI_DECOY_SECRET":     "deadbeef",
		"STI_ADDR":             "127.0.0.1:8080",
	}

	merged, added := addMissing(store, remote)

	// Only the two absent keys are added, sorted.
	want := []string{"STI_ADDR", "STI_DECOY_SECRET"}
	if len(added) != len(want) {
		t.Fatalf("added = %v, want %v", added, want)
	}
	for i := range want {
		if added[i] != want[i] {
			t.Fatalf("added = %v, want %v (sorted)", added, want)
		}
	}

	got := parseEnv(merged)
	if got["STI_VAPID_PUBLIC_KEY"] != "local-edit" {
		t.Fatalf("local edit clobbered: %q", got["STI_VAPID_PUBLIC_KEY"])
	}
	if got["STI_DECOY_SECRET"] != "deadbeef" || got["STI_ADDR"] != "127.0.0.1:8080" {
		t.Fatalf("missing keys not pulled in: %v", got)
	}

	// Idempotent: a second pull against the same remote adds nothing.
	if _, again := addMissing(merged, remote); len(again) != 0 {
		t.Fatalf("second addMissing added %v, want none", again)
	}
}

// newDecoyHex returns a fresh value in the format STI_DECOY_SECRET requires: hex
// that decodes to 32 bytes, and different each call.
func TestNewDecoyHex(t *testing.T) {
	a, err := newDecoyHex()
	if err != nil {
		t.Fatal(err)
	}
	b, err := newDecoyHex()
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two decoy secrets were identical")
	}
	raw, err := hex.DecodeString(a)
	if err != nil {
		t.Fatalf("not hex: %v", err)
	}
	if len(raw) != 32 {
		t.Fatalf("decoded length = %d, want 32", len(raw))
	}
}

// End to end: gen-decoy and gen-vapid encrypt real, well-formed keys into the store
// (decoy is 32 hex bytes; the VAPID pair is the base64url P-256 point + scalar the
// server and browser expect), using the same age round trip as `set`.
func TestGenDecoyAndVapidWriteValidKeys(t *testing.T) {
	dir := t.TempDir()
	identity, authLine := writeTestKey(t, dir)
	if err := os.WriteFile(filepath.Join(dir, "recipients.txt"), []byte(authLine), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg := Config{Dir: dir, Identity: identity}
	if err := cfg.save(storeHeader + "\n"); err != nil {
		t.Fatal(err)
	}

	if err := cmdGenDecoy(cfg); err != nil {
		t.Fatal(err)
	}
	if err := cmdGenVapid(cfg); err != nil {
		t.Fatal(err)
	}

	plain, err := cfg.load()
	if err != nil {
		t.Fatal(err)
	}
	env := parseEnv(plain)

	if raw, err := hex.DecodeString(env[keyDecoy]); err != nil || len(raw) != 32 {
		t.Fatalf("decoy %q: len %d err %v, want 32 bytes hex", env[keyDecoy], len(raw), err)
	}
	// VAPID public is the uncompressed P-256 point (65 bytes); private is the scalar
	// (32 bytes); both base64url without padding.
	if pub, err := base64.RawURLEncoding.DecodeString(env[keyVapidPublic]); err != nil || len(pub) != 65 {
		t.Fatalf("vapid public %q: len %d err %v, want 65 bytes", env[keyVapidPublic], len(pub), err)
	}
	if priv, err := base64.RawURLEncoding.DecodeString(env[keyVapidPrivate]); err != nil || len(priv) != 32 {
		t.Fatalf("vapid private %q: len %d err %v, want 32 bytes", env[keyVapidPrivate], len(priv), err)
	}
}

// newAdminToken returns a distinct token comfortably over the server's 32-char floor.
func TestNewAdminToken(t *testing.T) {
	a, err := newAdminToken()
	if err != nil {
		t.Fatal(err)
	}
	b, err := newAdminToken()
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two admin tokens were identical")
	}
	if len(a) < 32 {
		t.Fatalf("admin token length = %d, want >= 32 (the server's floor)", len(a))
	}
}

// gen-admin enables the operator surface in one step: it must set BOTH a long enough
// token and the flag, since the server refuses to boot with the flag on and no token.
func TestGenAdminSetsTokenAndFlag(t *testing.T) {
	dir := t.TempDir()
	identity, authLine := writeTestKey(t, dir)
	if err := os.WriteFile(filepath.Join(dir, "recipients.txt"), []byte(authLine), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg := Config{Dir: dir, Identity: identity}
	if err := cfg.save(storeHeader + "\n"); err != nil {
		t.Fatal(err)
	}

	if err := cmdGenAdmin(cfg); err != nil {
		t.Fatal(err)
	}

	plain, err := cfg.load()
	if err != nil {
		t.Fatal(err)
	}
	env := parseEnv(plain)
	if len(env[keyAdminToken]) < 32 {
		t.Fatalf("%s = %q (len %d), want >= 32", keyAdminToken, env[keyAdminToken], len(env[keyAdminToken]))
	}
	if env[keyAdminEnabled] != "true" {
		t.Fatalf("%s = %q, want true", keyAdminEnabled, env[keyAdminEnabled])
	}
}
