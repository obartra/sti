package server

import "sync"

// maxBuckets caps the per-limiter map so a flood of unique keys (e.g. knocks
// sprayed at random id+requester pairs) cannot exhaust memory between sweeps.
// ~100k buckets is a few MB; well under the box's headroom.
const maxBuckets = 100_000

// limiter is a simple per-key token bucket. Keys are opaque strings (an IP, an
// alias id, a requester hash). It refills at rate tokens/ms up to burst. Buckets
// live in memory; a restart just resets to full, which only ever loosens limits
// briefly, never breaks correctness.
type limiter struct {
	mu         sync.Mutex
	buckets    map[string]*tokenBucket
	rate       float64 // tokens per millisecond
	burst      float64
	maxBuckets int
}

type tokenBucket struct {
	tokens float64
	last   int64 // ms
}

func newLimiter(ratePerSec, burst float64) *limiter {
	return &limiter{
		buckets:    make(map[string]*tokenBucket),
		rate:       ratePerSec / 1000.0,
		burst:      burst,
		maxBuckets: maxBuckets,
	}
}

// allow takes one token for key at time now (ms), reporting whether it was available.
func (l *limiter) allow(key string, now int64) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.buckets[key]
	if !ok {
		if len(l.buckets) >= l.maxBuckets {
			l.evictOldestSample()
		}
		b = &tokenBucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	if now > b.last {
		b.tokens += float64(now-b.last) * l.rate
		if b.tokens > l.burst {
			b.tokens = l.burst
		}
		b.last = now
	}
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// evictOldestSample removes the oldest of a small random sample (approximate
// LRU), so the map can never grow past maxBuckets between sweeps. Evicting an
// active bucket only resets that key's limit, which is harmless (it loosens,
// never breaks). Bounded scan keeps this cheap on the hot path.
func (l *limiter) evictOldestSample() {
	const sample = 8
	var victim string
	var oldest int64
	first := true
	n := 0
	for k, b := range l.buckets {
		if first || b.last < oldest {
			oldest, victim, first = b.last, k, false
		}
		if n++; n >= sample {
			break
		}
	}
	if !first {
		delete(l.buckets, victim)
	}
}

// sweep drops buckets idle since before cutoff, bounding memory.
func (l *limiter) sweep(cutoff int64) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, b := range l.buckets {
		if b.last < cutoff {
			delete(l.buckets, k)
		}
	}
}
