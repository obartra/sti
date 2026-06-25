package store

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	_ "modernc.org/sqlite"
)

// openTestStore opens a real on-disk SQLite database in a temp dir (WAL and all),
// so these are integration tests against the production engine, not an in-memory
// shim.
func openTestStore(t *testing.T) *Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	s, err := Open(context.Background(), path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestAliasRoundTripAndOverwrite(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if _, _, found, err := s.GetAlias(ctx, "missing"); err != nil || found {
		t.Fatalf("missing alias: found=%v err=%v", found, err)
	}

	if ok, err := s.WriteAlias(ctx, "id1", []byte("cipher-a"), "owner-token", 100, sql.NullInt64{}, false); err != nil || !ok {
		t.Fatalf("first write: ok=%v err=%v", ok, err)
	}
	got, _, found, err := s.GetAlias(ctx, "id1")
	if err != nil || !found || !bytes.Equal(got, []byte("cipher-a")) {
		t.Fatalf("get after write: %q found=%v err=%v", got, found, err)
	}

	// The owner (matching write token) can overwrite.
	if ok, err := s.WriteAlias(ctx, "id1", []byte("cipher-b"), "owner-token", 200, sql.NullInt64{}, false); err != nil || !ok {
		t.Fatalf("owner overwrite: ok=%v err=%v", ok, err)
	}
	got, _, _, _ = s.GetAlias(ctx, "id1")
	if !bytes.Equal(got, []byte("cipher-b")) {
		t.Fatalf("overwrite: got %q, want cipher-b", got)
	}
}

func TestAliasWriteTokenRejectsNonOwner(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if ok, err := s.WriteAlias(ctx, "id1", []byte("cipher-a"), "owner-token", 100, sql.NullInt64{}, false); err != nil || !ok {
		t.Fatalf("first write: ok=%v err=%v", ok, err)
	}
	// A viewer holding the read id but not the write token cannot overwrite.
	ok, err := s.WriteAlias(ctx, "id1", []byte("evil"), "wrong-token", 200, sql.NullInt64{}, false)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("non-owner write was authorized")
	}
	got, _, _, _ := s.GetAlias(ctx, "id1")
	if !bytes.Equal(got, []byte("cipher-a")) {
		t.Fatalf("payload changed by non-owner: got %q", got)
	}
}

func TestAccountVersioning(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	v1, err := s.PutAccount(ctx, "acc", []byte("v1"), 100)
	if err != nil || v1 != 1 {
		t.Fatalf("first put: version=%d err=%v, want 1", v1, err)
	}
	v2, err := s.PutAccount(ctx, "acc", []byte("v2"), 200)
	if err != nil || v2 != 2 {
		t.Fatalf("second put: version=%d err=%v, want 2", v2, err)
	}
	cipher, version, found, err := s.GetAccount(ctx, "acc")
	if err != nil || !found || version != 2 || !bytes.Equal(cipher, []byte("v2")) {
		t.Fatalf("get: cipher=%q version=%d found=%v err=%v", cipher, version, found, err)
	}
}

func TestNotifyRoute(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if _, found, _ := s.GetNotifyRoute(ctx, "h"); found {
		t.Fatal("unexpected route")
	}
	if err := s.PutNotifyRoute(ctx, "h", "endpoint-1"); err != nil {
		t.Fatal(err)
	}
	ep, found, err := s.GetNotifyRoute(ctx, "h")
	if err != nil || !found || ep != "endpoint-1" {
		t.Fatalf("route: ep=%q found=%v err=%v", ep, found, err)
	}
}

func TestPushRegisterAndList(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	a := PushTarget{Endpoint: "https://push/a", P256dh: "p1", Auth: "a1"}
	b := PushTarget{Endpoint: "https://push/b", P256dh: "p2", Auth: "a2"}
	for _, tgt := range []PushTarget{a, b} {
		if err := s.RegisterPush(ctx, "ep", tgt, 100); err != nil {
			t.Fatal(err)
		}
	}
	// Re-registering the same endpoint refreshes, does not duplicate.
	if err := s.RegisterPush(ctx, "ep", PushTarget{Endpoint: "https://push/a", P256dh: "p1b", Auth: "a1b"}, 150); err != nil {
		t.Fatal(err)
	}
	got, err := s.PushEndpoints(ctx, "ep")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 endpoints, got %d", len(got))
	}
}

func TestSendQueue(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if err := s.EnqueueSend(ctx, "ep1", 200, 100); err != nil {
		t.Fatal(err)
	}
	if err := s.EnqueueSend(ctx, "ep2", 400, 100); err != nil {
		t.Fatal(err)
	}
	// At t=300 only the first is due.
	due, err := s.DueSends(ctx, 300, 10)
	if err != nil || len(due) != 1 || due[0].RoutingEndpointID != "ep1" {
		t.Fatalf("due at 300: %+v err=%v", due, err)
	}
	if err := s.DeleteSend(ctx, due[0].ID); err != nil {
		t.Fatal(err)
	}
	// At t=500 the second is due; the first was deleted.
	due, _ = s.DueSends(ctx, 500, 10)
	if len(due) != 1 || due[0].RoutingEndpointID != "ep2" {
		t.Fatalf("due at 500: %+v", due)
	}
}

func TestCoverQueueIsSeparateFromSendQueue(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	// A real send and a cover live in different tables: neither shows up in the
	// other's due query, so a cover can never re-trigger a fan-out.
	if err := s.EnqueueSend(ctx, "ep1", 100, 100); err != nil {
		t.Fatal(err)
	}
	if err := s.EnqueueCover(ctx, "ep2", 200, 100); err != nil {
		t.Fatal(err)
	}
	sends, err := s.DueSends(ctx, 1000, 10)
	if err != nil || len(sends) != 1 || sends[0].RoutingEndpointID != "ep1" {
		t.Fatalf("due sends: %+v err=%v", sends, err)
	}
	covers, err := s.DueCovers(ctx, 1000, 10)
	if err != nil || len(covers) != 1 || covers[0].RoutingEndpointID != "ep2" {
		t.Fatalf("due covers: %+v err=%v", covers, err)
	}
	// Covers honor their own availability and delete independently.
	if got, _ := s.DueCovers(ctx, 150, 10); len(got) != 0 {
		t.Fatalf("cover not yet due at 150, got %d", len(got))
	}
	if err := s.DeleteCover(ctx, covers[0].ID); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.DueCovers(ctx, 1000, 10); len(got) != 0 {
		t.Fatalf("deleted cover still due, got %d", len(got))
	}
	// The send queue was untouched by cover operations.
	if got, _ := s.DueSends(ctx, 1000, 10); len(got) != 1 {
		t.Fatalf("send queue disturbed by cover ops, due %d", len(got))
	}
}

func TestDistinctPushRoutes(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if got, err := s.DistinctPushRoutes(ctx); err != nil || len(got) != 0 {
		t.Fatalf("empty population: got %v err=%v", got, err)
	}
	// Two routes, one of them with two subscriptions: the population is the set of
	// routes, deduped, not the count of subscriptions.
	ok := func(err error) {
		if err != nil {
			t.Fatal(err)
		}
	}
	ok(s.RegisterPush(ctx, "route-a", PushTarget{Endpoint: "https://push/1", P256dh: "p", Auth: "a"}, 1))
	ok(s.RegisterPush(ctx, "route-a", PushTarget{Endpoint: "https://push/2", P256dh: "p", Auth: "a"}, 1))
	ok(s.RegisterPush(ctx, "route-b", PushTarget{Endpoint: "https://push/3", P256dh: "p", Auth: "a"}, 1))

	got, err := s.DistinctPushRoutes(ctx)
	if err != nil {
		t.Fatal(err)
	}
	set := map[string]bool{}
	for _, r := range got {
		set[r] = true
	}
	if len(got) != 2 || !set["route-a"] || !set["route-b"] {
		t.Fatalf("want {route-a, route-b}, got %v", got)
	}
}

func TestKnockDedupeCountAndPurge(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	const day = 24 * 60 * 60 * 1000
	created, err := s.RecordKnock(ctx, "target", "req1", "pubA", 1000, 1000+4*day)
	if err != nil || !created {
		t.Fatalf("first knock: created=%v err=%v", created, err)
	}
	// Same (target, requester) is deduped, and the original pub_key is preserved
	// (a dedup'd repeat with a different key must not clobber the stored one).
	created, err = s.RecordKnock(ctx, "target", "req1", "pubA2", 2000, 2000+4*day)
	if err != nil || created {
		t.Fatalf("dup knock: created=%v err=%v, want created=false", created, err)
	}
	// A different requester is a new knock; it carries no grant key.
	if created, _ := s.RecordKnock(ctx, "target", "req2", "", 3000, 3000+4*day); !created {
		t.Fatal("second requester should create")
	}

	// CurrentKnocks returns the live knocks with their keys, oldest first, so the
	// owner can seal a grant per requester.
	knocks, err := s.CurrentKnocks(ctx, "target", 500)
	if err != nil {
		t.Fatalf("current knocks: %v", err)
	}
	if len(knocks) != 2 {
		t.Fatalf("current knocks = %d, want 2", len(knocks))
	}
	if knocks[0].RequesterHash != "req1" || knocks[0].PubKey != "pubA" {
		t.Fatalf("knock[0] = %+v, want {req1 pubA} (original key preserved)", knocks[0])
	}
	if knocks[1].RequesterHash != "req2" || knocks[1].PubKey != "" {
		t.Fatalf("knock[1] = %+v, want {req2 ''}", knocks[1])
	}

	n, err := s.RecentKnockCount(ctx, "target", 0)
	if err != nil || n != 2 {
		t.Fatalf("recent count: n=%d err=%v, want 2", n, err)
	}

	// Purge after everything has expired.
	purged, err := s.PurgeExpiredKnocks(ctx, 100*day)
	if err != nil || purged != 2 {
		t.Fatalf("purge: purged=%d err=%v, want 2", purged, err)
	}
	if n, _ := s.RecentKnockCount(ctx, "target", 0); n != 0 {
		t.Fatalf("after purge count = %d, want 0", n)
	}
}

// TestKnockPubKeyNotUpgradedOnReknock pins the known dedup limitation: a first
// contentless knock ("") is NOT upgraded by a later keyed re-knock. The owner
// keeps seeing "" (no grant slot) rather than the new key; this is the safe
// failure mode (no grant beats a wrong-recipient grant) and is documented on
// RecordKnock, so it is pinned here rather than left to surprise a later slice.
func TestKnockPubKeyNotUpgradedOnReknock(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	const day = 24 * 60 * 60 * 1000

	if _, err := s.RecordKnock(ctx, "t", "req", "", 1000, 1000+4*day); err != nil {
		t.Fatal(err)
	}
	// A later knock from the same requester carrying a key is deduped away.
	if _, err := s.RecordKnock(ctx, "t", "req", "laterKey", 2000, 2000+4*day); err != nil {
		t.Fatal(err)
	}
	knocks, err := s.CurrentKnocks(ctx, "t", 1500)
	if err != nil {
		t.Fatal(err)
	}
	if len(knocks) != 1 || knocks[0].PubKey != "" {
		t.Fatalf("knock = %+v, want one with PubKey '' (contentless not upgraded)", knocks)
	}
}

// TestMigrateAddsKnockPubKey pins the in-place migration for an existing
// production database: a knock table created BEFORE pub_key existed must gain the
// column on Open, keep its rows, and read back the old key as empty. Without this,
// the deployed db would either fail to open or silently lose the knock history.
func TestMigrateAddsKnockPubKey(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "legacy.db")

	// Stand up a database with the OLD knock schema (no pub_key) and one row.
	legacy, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := legacy.ExecContext(ctx, `CREATE TABLE knock (
		target_id      TEXT NOT NULL,
		requester_hash TEXT NOT NULL,
		created_at     INTEGER NOT NULL,
		expires_at     INTEGER NOT NULL,
		PRIMARY KEY (target_id, requester_hash)
	) WITHOUT ROWID;`); err != nil {
		t.Fatal(err)
	}
	if _, err := legacy.ExecContext(ctx,
		`INSERT INTO knock (target_id, requester_hash, created_at, expires_at) VALUES ('t', 'old-req', 10, 1000)`); err != nil {
		t.Fatal(err)
	}
	legacy.Close()

	// Open through the store: schema (CREATE TABLE IF NOT EXISTS is a no-op here)
	// plus migrate must add pub_key and leave the row intact.
	s, err := Open(ctx, path)
	if err != nil {
		t.Fatalf("open legacy db: %v", err)
	}
	t.Cleanup(func() { s.Close() })

	knocks, err := s.CurrentKnocks(ctx, "t", 100)
	if err != nil {
		t.Fatalf("current knocks: %v", err)
	}
	if len(knocks) != 1 || knocks[0].RequesterHash != "old-req" || knocks[0].PubKey != "" {
		t.Fatalf("migrated knock = %+v, want one {old-req ''}", knocks)
	}

	// A fresh knock can now store a key, proving the column is usable.
	if _, err := s.RecordKnock(ctx, "t", "new-req", "newKey", 20, 1000); err != nil {
		t.Fatalf("record after migrate: %v", err)
	}
	knocks, _ = s.CurrentKnocks(ctx, "t", 100)
	if len(knocks) != 2 {
		t.Fatalf("after new knock = %d rows, want 2", len(knocks))
	}

	// Open again: migrate is idempotent (the column already exists).
	s.Close()
	s2, err := Open(ctx, path)
	if err != nil {
		t.Fatalf("re-open: %v", err)
	}
	t.Cleanup(func() { s2.Close() })
}

// TestConcurrentWritesPersist fires many WriteAlias calls in parallel against a
// real on-disk SQLite db and asserts every authorized write is durably readable.
// A single-threaded write path passes trivially; this pins the concurrent path,
// where an under-configured connection pool can ack a write that never lands.
func TestConcurrentWritesPersist(t *testing.T) {
	s := openTestStore(t)
	ctx := context.Background()
	const n = 500

	var wg sync.WaitGroup
	errs := make([]error, n)
	oks := make([]bool, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			id := fmt.Sprintf("id-%04d", i)
			oks[i], errs[i] = s.WriteAlias(ctx, id, []byte(id+"-cipher"), "tok", int64(i), sql.NullInt64{}, false)
		}(i)
	}
	wg.Wait()

	missing := 0
	for i := 0; i < n; i++ {
		if errs[i] != nil {
			t.Fatalf("write %d errored: %v", i, errs[i])
		}
		if !oks[i] {
			t.Fatalf("write %d not authorized", i)
		}
		id := fmt.Sprintf("id-%04d", i)
		got, _, found, err := s.GetAlias(ctx, id)
		if err != nil {
			t.Fatalf("get %s: %v", id, err)
		}
		if !found || !bytes.Equal(got, []byte(id+"-cipher")) {
			missing++
		}
	}
	if missing > 0 {
		t.Fatalf("%d/%d writes returned ok but were not persisted (data loss)", missing, n)
	}
}

func TestVanityNameLifecycle(t *testing.T) {
	s := openTestStore(t)
	ctx := context.Background()
	const name = "robin"
	const lock = int64(24 * 60 * 60 * 1000) // 24h in ms

	// Unknown name: a real not-found (the directory is non-uniform by design).
	if _, found, err := s.ResolveVanityName(ctx, name); err != nil || found {
		t.Fatalf("unknown name: found=%v err=%v, want found=false", found, err)
	}

	// First-come claim, then resolve to the opaque alias id.
	if st, err := s.ClaimVanityName(ctx, name, "alias-one", 1000); err != nil || st != VanityClaimed {
		t.Fatalf("claim: st=%v err=%v, want Claimed", st, err)
	}
	if got, found, err := s.ResolveVanityName(ctx, name); err != nil || !found || got != "alias-one" {
		t.Fatalf("resolve: got=%q found=%v err=%v, want alias-one/true", got, found, err)
	}

	// The same alias re-claiming is idempotent (still held, still alias-one).
	if st, err := s.ClaimVanityName(ctx, name, "alias-one", 1001); err != nil || st != VanityClaimed {
		t.Fatalf("idempotent re-claim: st=%v err=%v", st, err)
	}

	// A different alias cannot take a name another alias actively holds.
	if st, _ := s.ClaimVanityName(ctx, name, "alias-two", 1002); st != VanityTaken {
		t.Fatalf("claim by other: st=%v, want Taken", st)
	}
	if got, _, _ := s.ResolveVanityName(ctx, name); got != "alias-one" {
		t.Fatalf("still held: got %q, want alias-one", got)
	}

	// Release into the post-release lock: it stops resolving at once.
	const now = int64(2000)
	if err := s.ReleaseVanityName(ctx, name, now, lock); err != nil {
		t.Fatal(err)
	}
	if _, found, _ := s.ResolveVanityName(ctx, name); found {
		t.Fatal("after release: want not found")
	}

	// During the lock, NO ONE can reclaim it (not even the prior owner).
	if st, _ := s.ClaimVanityName(ctx, name, "alias-one", now+lock-1); st != VanityLocked {
		t.Fatalf("reclaim during lock (prior owner): st=%v, want Locked", st)
	}
	if st, _ := s.ClaimVanityName(ctx, name, "alias-three", now+lock-1); st != VanityLocked {
		t.Fatalf("reclaim during lock (other): st=%v, want Locked", st)
	}

	// Once the lock lapses, it is reclaimable first-come by anyone.
	if st, err := s.ClaimVanityName(ctx, name, "alias-three", now+lock); err != nil || st != VanityClaimed {
		t.Fatalf("reclaim after lock: st=%v err=%v, want Claimed", st, err)
	}
	if got, _, _ := s.ResolveVanityName(ctx, name); got != "alias-three" {
		t.Fatalf("after reclaim: got %q, want alias-three", got)
	}

	// Release is idempotent (re-releasing simply re-locks).
	if err := s.ReleaseVanityName(ctx, name, now, lock); err != nil {
		t.Fatalf("release not idempotent: %v", err)
	}
}

// The admin audit log is append-only and newest-first: each AppendAudit adds a
// row, RecentAudits returns them most-recent-first bounded by limit, and the
// opaque action/target round-trip intact (doc 20).
func TestAdminAuditAppendAndList(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if got, err := s.RecentAudits(ctx, 0, 10); err != nil || len(got) != 0 {
		t.Fatalf("empty log: got %d err %v", len(got), err)
	}

	if err := s.AppendAudit(ctx, "ping", "", 100); err != nil {
		t.Fatal(err)
	}
	if err := s.AppendAudit(ctx, "vanity.takedown", "robin", 200); err != nil {
		t.Fatal(err)
	}

	got, err := s.RecentAudits(ctx, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("len = %d, want 2", len(got))
	}
	// Newest first: the takedown (id 2) precedes the ping (id 1).
	if got[0].Action != "vanity.takedown" || got[0].Target != "robin" || got[0].CreatedAt != 200 {
		t.Fatalf("newest row = %+v", got[0])
	}
	if got[1].Action != "ping" || got[1].Target != "" {
		t.Fatalf("oldest row = %+v", got[1])
	}

	// limit bounds the result to the most recent rows.
	if one, err := s.RecentAudits(ctx, 0, 1); err != nil || len(one) != 1 || one[0].Action != "vanity.takedown" {
		t.Fatalf("limit 1: got %+v err %v", one, err)
	}
}

// Vanity reports aggregate per name for the admin review queue: count, first-seen
// time, and most-recent reason, busiest first; clearing removes a name's set.
func TestVanityReports(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)

	if got, err := s.PendingVanityReports(ctx, 10); err != nil || len(got) != 0 {
		t.Fatalf("empty queue: %d err %v", len(got), err)
	}

	// robin and alice are registered (a non-empty alias_id); ghost is not.
	if _, err := s.ClaimVanityName(ctx, "robin", "alias-robin", 1); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ClaimVanityName(ctx, "alice", "alias-alice", 1); err != nil {
		t.Fatal(err)
	}
	if err := s.AddVanityReport(ctx, "robin", "impersonation", 100); err != nil {
		t.Fatal(err)
	}
	if err := s.AddVanityReport(ctx, "robin", "abuse", 200); err != nil {
		t.Fatal(err)
	}
	if err := s.AddVanityReport(ctx, "alice", "spam", 150); err != nil {
		t.Fatal(err)
	}
	// A report for an UNregistered name never reaches the queue: intake is
	// existence-uniform, so orphans are dropped on read, not refused at write.
	if err := s.AddVanityReport(ctx, "ghost", "spam", 120); err != nil {
		t.Fatal(err)
	}

	got, err := s.PendingVanityReports(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("queue rows = %d, want 2 (ghost excluded)", len(got))
	}
	// Busiest first: robin (2 reports) before alice (1); robin's row aggregates to
	// count 2, the earliest created_at (100), and the most-recent reason (abuse).
	if got[0].Name != "robin" || got[0].Count != 2 || got[0].CreatedAt != 100 || got[0].Reason != "abuse" {
		t.Fatalf("robin row = %+v", got[0])
	}
	if got[1].Name != "alice" || got[1].Count != 1 {
		t.Fatalf("alice row = %+v", got[1])
	}

	// Releasing a name (alias_id = '') drops it from the queue even though its report
	// rows still exist: only a currently-registered name is actionable.
	if err := s.ReleaseVanityName(ctx, "alice", 300, 0); err != nil {
		t.Fatal(err)
	}
	if got2, _ := s.PendingVanityReports(ctx, 10); len(got2) != 1 || got2[0].Name != "robin" {
		t.Fatalf("after release alice: %+v", got2)
	}

	// Clearing a name empties the queue; clearing an unreported name is a no-op.
	if err := s.ClearVanityReports(ctx, "robin"); err != nil {
		t.Fatal(err)
	}
	if got3, _ := s.PendingVanityReports(ctx, 10); len(got3) != 0 {
		t.Fatalf("after clear robin: %+v", got3)
	}
	if err := s.ClearVanityReports(ctx, "nobody"); err != nil {
		t.Fatalf("clear no-op: %v", err)
	}
}

// Admin record management (doc 20 A3): force-delete an alias (it then reads as a
// miss), release the vanity names pointing at it into the lock, and read opaque
// metadata across the alias/account/inbox tables — never any content.
func TestAdminRecordManagement(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	const lock = int64(24 * 60 * 60 * 1000)

	if _, err := s.WriteAlias(ctx, "a1", []byte("cipher6"), "wt", 100, sql.NullInt64{}, false); err != nil {
		t.Fatal(err)
	}
	if _, err := s.PutAccount(ctx, "acc1", []byte("blob"), 200); err != nil {
		t.Fatal(err)
	}
	if st, err := s.ClaimVanityName(ctx, "robin", "a1", 100); err != nil || st != VanityClaimed {
		t.Fatalf("claim: %v %v", st, err)
	}

	// Lookup reports opaque metadata only, for the right namespace.
	m, err := s.LookupRecord(ctx, "a1")
	if err != nil {
		t.Fatal(err)
	}
	if !m.Alias.Exists || m.Alias.SizeBytes != int64(len("cipher6")) || m.Alias.UpdatedAt != 100 {
		t.Fatalf("alias meta = %+v", m.Alias)
	}
	if m.Account.Exists || m.Inbox.Exists {
		t.Fatalf("alias id leaked into account/inbox: %+v", m)
	}
	if am, _ := s.LookupRecord(ctx, "acc1"); !am.Account.Exists || am.Alias.Exists {
		t.Fatalf("account meta = %+v", am)
	}
	if mm, _ := s.LookupRecord(ctx, "missing"); mm.Alias.Exists || mm.Account.Exists || mm.Inbox.Exists {
		t.Fatalf("missing id reported as existing: %+v", mm)
	}

	// Revoke the alias: it is gone, and its vanity name is released into the lock.
	if err := s.AdminDeleteAlias(ctx, "a1"); err != nil {
		t.Fatal(err)
	}
	if _, _, found, _ := s.GetAlias(ctx, "a1"); found {
		t.Fatal("alias still present after AdminDeleteAlias")
	}
	if err := s.ReleaseVanityNamesForAlias(ctx, "a1", 1000, lock); err != nil {
		t.Fatal(err)
	}
	if _, found, _ := s.ResolveVanityName(ctx, "robin"); found {
		t.Fatal("vanity name still resolves after its alias was revoked")
	}
	// Idempotent: both ops are no-ops on already-gone records.
	if err := s.AdminDeleteAlias(ctx, "a1"); err != nil {
		t.Fatalf("delete idempotent: %v", err)
	}
	if err := s.ReleaseVanityNamesForAlias(ctx, "a1", 1000, lock); err != nil {
		t.Fatalf("release idempotent: %v", err)
	}
}
