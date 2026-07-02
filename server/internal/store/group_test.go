package store

import (
	"bytes"
	"context"
	"testing"

	_ "modernc.org/sqlite"
)

// The group blob rides the shared writeFixed/getFixed primitives, so this pins the
// same round-trip and capability behavior the alias/inbox stores have: a first write
// binds the write auth, and only a matching auth overwrites.
func TestGroupBlobRoundTripAndOverwrite(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if _, found, err := s.GetGroupBlob(ctx, "missing"); err != nil || found {
		t.Fatalf("missing id: found=%v err=%v", found, err)
	}

	if ok, err := s.WriteGroupBlob(ctx, "grp", []byte("blob-a"), "owner-auth", 100); err != nil || !ok {
		t.Fatalf("first write: ok=%v err=%v", ok, err)
	}
	got, found, err := s.GetGroupBlob(ctx, "grp")
	if err != nil || !found || !bytes.Equal(got, []byte("blob-a")) {
		t.Fatalf("get after write: %q found=%v err=%v", got, found, err)
	}

	// The binding owner (matching write auth) overwrites in place.
	if ok, err := s.WriteGroupBlob(ctx, "grp", []byte("blob-b"), "owner-auth", 200); err != nil || !ok {
		t.Fatalf("owner overwrite: ok=%v err=%v", ok, err)
	}
	got, _, _ = s.GetGroupBlob(ctx, "grp")
	if !bytes.Equal(got, []byte("blob-b")) {
		t.Fatalf("overwrite: got %q, want blob-b", got)
	}
}

// A write against an id held under a different write auth is refused (authorized
// =false) and leaves the stored blob untouched: no one can clobber another admin's
// group blob, the store-level half of the "no new oracle" write guarantee.
func TestGroupBlobWrongAuthCannotOverwrite(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if ok, err := s.WriteGroupBlob(ctx, "grp", []byte("owner-blob"), "owner-auth", 100); err != nil || !ok {
		t.Fatalf("owner write: ok=%v err=%v", ok, err)
	}
	ok, err := s.WriteGroupBlob(ctx, "grp", []byte("attacker-blob"), "other-auth", 200)
	if err != nil {
		t.Fatalf("colliding write errored: %v", err)
	}
	if ok {
		t.Fatal("a mismatched write auth was authorized to overwrite")
	}
	got, found, err := s.GetGroupBlob(ctx, "grp")
	if err != nil || !found || !bytes.Equal(got, []byte("owner-blob")) {
		t.Fatalf("collision overwrote the owner's blob: got %q found=%v err=%v", got, found, err)
	}
}

// Only the binding write auth deletes the blob. A mismatched token is refused
// (authorized=false) and the blob survives; a missing id is an idempotent success.
func TestGroupBlobDeleteAuthorized(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if ok, err := s.WriteGroupBlob(ctx, "grp", []byte("owner-blob"), "owner-auth", 100); err != nil || !ok {
		t.Fatalf("write: ok=%v err=%v", ok, err)
	}
	// Wrong token: refused, blob stays.
	if ok, err := s.DeleteGroupBlob(ctx, "grp", "wrong-auth"); err != nil || ok {
		t.Fatalf("mismatched delete: ok=%v err=%v (want ok=false)", ok, err)
	}
	if _, found, _ := s.GetGroupBlob(ctx, "grp"); !found {
		t.Fatal("mismatched delete removed the blob")
	}
	// A never-written id: idempotent success.
	if ok, err := s.DeleteGroupBlob(ctx, "nobody", "any-auth"); err != nil || !ok {
		t.Fatalf("missing delete: ok=%v err=%v (want ok=true)", ok, err)
	}
	// Right token: gone.
	if ok, err := s.DeleteGroupBlob(ctx, "grp", "owner-auth"); err != nil || !ok {
		t.Fatalf("owner delete: ok=%v err=%v", ok, err)
	}
	if _, found, _ := s.GetGroupBlob(ctx, "grp"); found {
		t.Fatal("owner delete did not remove the blob")
	}
}
