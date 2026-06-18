package server

import (
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
