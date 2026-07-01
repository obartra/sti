package store

import (
	"bytes"
	"context"
	"testing"

	_ "modernc.org/sqlite"
)

func TestRecoveryEnvelopeRoundTripAndOverwrite(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if _, found, err := s.GetRecoveryEnvelope(ctx, "missing"); err != nil || found {
		t.Fatalf("missing locator: found=%v err=%v", found, err)
	}

	if err := s.PutRecoveryEnvelope(ctx, "meow", []byte("envelope-a"), "owner-auth", 100); err != nil {
		t.Fatalf("first put: %v", err)
	}
	got, found, err := s.GetRecoveryEnvelope(ctx, "meow")
	if err != nil || !found || !bytes.Equal(got, []byte("envelope-a")) {
		t.Fatalf("get after put: %q found=%v err=%v", got, found, err)
	}

	// The owner (matching write auth) re-wraps a fresh envelope in place.
	if err := s.PutRecoveryEnvelope(ctx, "meow", []byte("envelope-b"), "owner-auth", 200); err != nil {
		t.Fatalf("owner overwrite: %v", err)
	}
	got, _, _ = s.GetRecoveryEnvelope(ctx, "meow")
	if !bytes.Equal(got, []byte("envelope-b")) {
		t.Fatalf("overwrite: got %q, want envelope-b", got)
	}
}

// TestRecoveryEnvelopeCollisionIsSilentNoOp pins that a PUT against a locator held
// under a different write auth neither overwrites nor errors: the store leaves the
// original envelope untouched and returns nil, so the write path reveals nothing
// about whether a locator is taken (the complement of the decoy-uniform read).
func TestRecoveryEnvelopeCollisionIsSilentNoOp(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if err := s.PutRecoveryEnvelope(ctx, "meow", []byte("owner-env"), "owner-auth", 100); err != nil {
		t.Fatalf("owner put: %v", err)
	}
	// A different account (different write auth) puts to the same locator: no error,
	// and the stored envelope is unchanged.
	if err := s.PutRecoveryEnvelope(ctx, "meow", []byte("attacker-env"), "other-auth", 200); err != nil {
		t.Fatalf("colliding put: %v", err)
	}
	got, found, err := s.GetRecoveryEnvelope(ctx, "meow")
	if err != nil || !found {
		t.Fatalf("get: found=%v err=%v", found, err)
	}
	if !bytes.Equal(got, []byte("owner-env")) {
		t.Fatalf("collision overwrote the owner's envelope: got %q", got)
	}
}

// TestRecoveryEnvelopeDeleteAuthorized pins that only the binding write auth deletes
// the envelope, and both a mismatched token and a missing locator are silent no-ops
// (no error), so the delete path never reveals which locators exist.
func TestRecoveryEnvelopeDeleteAuthorized(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if err := s.PutRecoveryEnvelope(ctx, "meow", []byte("owner-env"), "owner-auth", 100); err != nil {
		t.Fatalf("put: %v", err)
	}
	// Wrong token: no-op, envelope stays.
	if err := s.DeleteRecoveryEnvelope(ctx, "meow", "wrong-auth"); err != nil {
		t.Fatalf("mismatched delete errored: %v", err)
	}
	if _, found, _ := s.GetRecoveryEnvelope(ctx, "meow"); !found {
		t.Fatal("mismatched delete removed the envelope")
	}
	// A never-registered locator: idempotent no-op.
	if err := s.DeleteRecoveryEnvelope(ctx, "nobody", "any-auth"); err != nil {
		t.Fatalf("missing delete errored: %v", err)
	}
	// Right token: gone.
	if err := s.DeleteRecoveryEnvelope(ctx, "meow", "owner-auth"); err != nil {
		t.Fatalf("owner delete: %v", err)
	}
	if _, found, _ := s.GetRecoveryEnvelope(ctx, "meow"); found {
		t.Fatal("owner delete did not remove the envelope")
	}
}
