package server

import "testing"

func BenchmarkDecoyBytes(b *testing.B) {
	secret := make([]byte, 32)
	id := "g67bxzEajkMC_rAYUhqcBg4hs9mPQ1YgPdPvmlFrva4"
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = decoyBytes(secret, id, 4096)
	}
}
