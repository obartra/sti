package server

import (
	"strconv"
	"testing"
)

// a flood of unique keys must not grow the bucket map past the cap, and must
// not start denying brand-new keys (eviction makes room rather than rejecting).
func TestLimiterBoundsMemoryUnderUniqueKeyFlood(t *testing.T) {
	l := newLimiter(1, 5)
	l.maxBuckets = 100

	denied := 0
	for i := 0; i < 10_000; i++ {
		if !l.allow("key-"+strconv.Itoa(i), int64(i)) {
			denied++
		}
	}
	if got := len(l.buckets); got > l.maxBuckets {
		t.Fatalf("map grew to %d, cap is %d", got, l.maxBuckets)
	}
	// Each key is fresh (full burst) so its first token is always available;
	// eviction must never turn that into a denial.
	if denied != 0 {
		t.Fatalf("%d brand-new keys were denied; eviction should make room", denied)
	}
}
