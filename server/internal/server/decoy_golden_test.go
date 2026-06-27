package server

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

// pins the exact decoy output so any refactor stays byte-identical on the wire.
func TestDecoyGolden(t *testing.T) {
	secret := make([]byte, 32)
	for i := range secret {
		secret[i] = byte(i)
	}
	got := sha256.Sum256(decoyBytes(secret, "fixed-id-for-golden", 4096))
	const want = "2da77ae87e92db64efcd4835b3fb1abc2e778e0ac7160548ab2675e1c3f81bb0"
	if hex.EncodeToString(got[:]) != want {
		t.Fatalf("decoy output changed:\n got %s", hex.EncodeToString(got[:]))
	}
}

// TestDecoyDependsOnSecret pins the keystone of GET /a existence-uniformity: the
// decoy is HMAC-keyed by the per-deployment secret, so two different secrets must
// yield different decoys for the same id. Without this, a secret-ignoring
// regression (e.g. an unkeyed hash) would make every id's decoy globally
// recomputable, turning the uniform read into a hit/miss oracle, and the golden
// test would survive it (it only needs its one constant regenerated).
func TestDecoyDependsOnSecret(t *testing.T) {
	secretA := bytes.Repeat([]byte{0x01}, 32)
	secretB := bytes.Repeat([]byte{0x02}, 32)
	if bytes.Equal(decoyBytes(secretA, "same-id", 4096), decoyBytes(secretB, "same-id", 4096)) {
		t.Fatal("decoy is identical for two different secrets; it must be keyed by the secret")
	}
}

// TestDecoyVariesById pins that distinct ids get distinct decoys under one secret,
// so a missing id's stand-in is not confused with another's. It also catches an
// id-ignoring regression that the single-id golden test would miss.
func TestDecoyVariesById(t *testing.T) {
	secret := bytes.Repeat([]byte{0x07}, 32)
	if bytes.Equal(decoyBytes(secret, "id-1", 4096), decoyBytes(secret, "id-2", 4096)) {
		t.Fatal("decoy is identical for two different ids; it must depend on the id")
	}
}
