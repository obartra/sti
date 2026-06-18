package server

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
)

// decoyBytes deterministically derives size pseudorandom bytes for an id, keyed
// by a server secret. It is stable per id (a repeated miss returns identical
// bytes, exactly as a real stored ciphertext would) and is indistinguishable
// from random without the key. This is what makes "doesn't exist" and "can't
// decrypt" byte-identical on the wire: every GET /a response is size bytes of
// high-entropy data, real or not.
func decoyBytes(secret []byte, id string, size int) []byte {
	out := make([]byte, size)
	// Key the HMAC once and Reset per block: re-creating it each iteration
	// re-pads the key (two extra SHA-256 compressions per block), which on a
	// 4096-byte payload is the bulk of the work. Output is identical (pinned by
	// the golden test); this just halves the per-read cost on the miss path.
	h := hmac.New(sha256.New, secret)
	idb := []byte(id)
	var c [4]byte
	var sum [sha256.Size]byte
	var counter uint32
	for off := 0; off < size; off += sha256.Size {
		h.Reset()
		h.Write(idb)
		binary.BigEndian.PutUint32(c[:], counter)
		h.Write(c[:])
		copy(out[off:], h.Sum(sum[:0]))
		counter++
	}
	return out
}
