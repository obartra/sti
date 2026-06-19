package store

import (
	"bytes"
	"context"
	"path/filepath"
	"testing"
)

func TestStatsCountsOpaqueRows(t *testing.T) {
	ctx := context.Background()
	st, err := Open(ctx, filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()

	s0, err := st.Stats(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if s0.AliasRows != 0 || s0.AccountRows != 0 || s0.KnockRows != 0 || s0.SendQueueDepth != 0 {
		t.Fatalf("fresh db should be empty, got %+v", s0)
	}
	if s0.DBSizeBytes <= 0 {
		t.Errorf("DBSizeBytes should be positive, got %d", s0.DBSizeBytes)
	}

	ct := bytes.Repeat([]byte{0x01}, 4096)
	if _, err := st.WriteAlias(ctx, "alias-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ct, "h", 1); err != nil {
		t.Fatal(err)
	}
	if _, err := st.PutAccount(ctx, "acct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ct, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := st.RecordKnock(ctx, "alias-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "req", 1, 99); err != nil {
		t.Fatal(err)
	}
	if err := st.EnqueueSend(ctx, "ep", 1, 1); err != nil {
		t.Fatal(err)
	}

	s1, err := st.Stats(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if s1.AliasRows != 1 || s1.AccountRows != 1 || s1.KnockRows != 1 || s1.SendQueueDepth != 1 {
		t.Fatalf("after writes: %+v", s1)
	}
}
