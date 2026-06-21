// Package store is the blind persistence layer: opaque ciphertext and opaque
// routing tokens keyed by opaque id, in embedded SQLite (WAL). It holds no PII
// and runs no badge logic. Timestamps are passed in by the caller (Unix millis)
// so behavior is deterministic and testable.
package store

import (
	"context"
	"crypto/subtle"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"net/url"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

// Store is a handle to the SQLite-backed blind store.
type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at path and applies the
// schema. WAL mode plus a busy timeout let many readers run alongside the single
// writer without spurious "database is locked" errors.
func Open(ctx context.Context, path string) (*Store, error) {
	dsn := "file:" + path + "?" + url.Values{
		"_pragma": {
			"journal_mode(WAL)",
			"busy_timeout(5000)",
			"synchronous(NORMAL)",
		},
		// Start every transaction with BEGIN IMMEDIATE so a write tx takes the
		// write lock up front. A deferred tx that SELECTs then upgrades to a
		// write hits SQLITE_BUSY_SNAPSHOT under concurrency (busy_timeout does
		// not retry a snapshot upgrade), which silently loses writes. With
		// IMMEDIATE, concurrent writers wait on busy_timeout and serialize
		// cleanly. WAL readers are unaffected and still run concurrently.
		"_txlock": {"immediate"},
	}.Encode()

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// SQLite has a single writer. Cap the pool to one connection so all access
	// serializes through it: without this, database/sql opens many connections
	// and concurrent write transactions collide (SQLITE_BUSY / lost writes that
	// were still acked). One connection is correct for every write path at once,
	// and a point-lookup read on this schema is sub-millisecond.
	db.SetMaxOpenConns(1)
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	if _, err := db.ExecContext(ctx, schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	if err := migrate(ctx, db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &Store{db: db}, nil
}

// migrate applies additive schema changes that CREATE TABLE IF NOT EXISTS can't
// reach on an already-created table. Each step is idempotent (guarded by a column
// check) so it is safe to run on every Open, including a fresh database where the
// embedded schema already has the final shape.
func migrate(ctx context.Context, db *sql.DB) error {
	// knock.pub_key: the opaque ephemeral grant key carried on a knock (doc 13).
	// Older databases have a knock table without it; add it in place.
	has, err := hasColumn(ctx, db, "knock", "pub_key")
	if err != nil {
		return err
	}
	if !has {
		if _, err := db.ExecContext(ctx,
			`ALTER TABLE knock ADD COLUMN pub_key TEXT NOT NULL DEFAULT ''`); err != nil {
			return fmt.Errorf("add knock.pub_key: %w", err)
		}
	}
	return nil
}

// hasColumn reports whether table has a column named col, via PRAGMA table_info.
func hasColumn(ctx context.Context, db *sql.DB, table, col string) (bool, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			cid        int
			name, typ  string
			notNull    int
			dflt       sql.NullString
			primaryKey int
		)
		if err := rows.Scan(&cid, &name, &typ, &notNull, &dflt, &primaryKey); err != nil {
			return false, err
		}
		if name == col {
			return true, rows.Err()
		}
	}
	return false, rows.Err()
}

// Close releases the database handle.
func (s *Store) Close() error { return s.db.Close() }

// --- Alias + notify inbox (fixed-size, write-token-gated, blind reads) -------
//
// The alias and notify_inbox tables are identical in shape (opaque id ->
// fixed-size ciphertext gated by a write-token hash, read existence-uniformly),
// so the create/overwrite and read logic is shared. The `table` argument is ONLY
// ever a compile-time constant from {aliasTable, inboxTable}, never request data,
// so the formatted SQL carries no injection.
const (
	aliasTable = "alias"
	inboxTable = "notify_inbox"
)

// writeFixed creates a row (recording writeAuth as its capability) or, if the id
// exists, overwrites it only when writeAuth matches. authorized=false means the
// id exists but the caller doesn't hold its write token. Transactional so
// concurrent first-writers can't race.
func (s *Store) writeFixed(ctx context.Context, table, id string, ciphertext []byte, writeAuth string, now int64) (authorized bool, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var existing string
	sel := fmt.Sprintf("SELECT write_auth FROM %s WHERE id = ?", table)
	switch err := tx.QueryRowContext(ctx, sel, id).Scan(&existing); {
	case errors.Is(err, sql.ErrNoRows):
		ins := fmt.Sprintf("INSERT INTO %s (id, ciphertext, write_auth, updated_at) VALUES (?, ?, ?, ?)", table)
		if _, err := tx.ExecContext(ctx, ins, id, ciphertext, writeAuth, now); err != nil {
			return false, err
		}
	case err != nil:
		return false, err
	default:
		// Constant-time compare of the stored vs candidate token hash.
		if subtle.ConstantTimeCompare([]byte(existing), []byte(writeAuth)) != 1 {
			return false, nil
		}
		upd := fmt.Sprintf("UPDATE %s SET ciphertext = ?, updated_at = ? WHERE id = ?", table)
		if _, err := tx.ExecContext(ctx, upd, ciphertext, now, id); err != nil {
			return false, err
		}
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

// getFixed returns the stored payload and whether it exists. Callers MUST NOT
// turn found=false into a distinguishable response (see the decoy rule).
func (s *Store) getFixed(ctx context.Context, table, id string) (ciphertext []byte, found bool, err error) {
	sel := fmt.Sprintf("SELECT ciphertext FROM %s WHERE id = ?", table)
	err = s.db.QueryRowContext(ctx, sel, id).Scan(&ciphertext)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return ciphertext, true, nil
}

// WriteAlias / GetAlias: the public card store (the hot existence-uniform read).
func (s *Store) WriteAlias(ctx context.Context, id string, ciphertext []byte, writeAuth string, now int64) (authorized bool, err error) {
	return s.writeFixed(ctx, aliasTable, id, ciphertext, writeAuth, now)
}

func (s *Store) GetAlias(ctx context.Context, id string) (ciphertext []byte, found bool, err error) {
	return s.getFixed(ctx, aliasTable, id)
}

// WriteInbox / GetInbox: the per-device notify inbox (doc 13). Same shape and
// blind read as alias, separate table.
func (s *Store) WriteInbox(ctx context.Context, id string, ciphertext []byte, writeAuth string, now int64) (authorized bool, err error) {
	return s.writeFixed(ctx, inboxTable, id, ciphertext, writeAuth, now)
}

func (s *Store) GetInbox(ctx context.Context, id string) (ciphertext []byte, found bool, err error) {
	return s.getFixed(ctx, inboxTable, id)
}

// --- Account sync blob ------------------------------------------------------

// PutAccount stores or replaces the account blob (last-write-wins) and returns
// the new monotonically increasing version.
func (s *Store) PutAccount(ctx context.Context, id string, ciphertext []byte, now int64) (version int64, err error) {
	err = s.db.QueryRowContext(ctx,
		`INSERT INTO account (id, ciphertext, version, updated_at) VALUES (?, ?, 1, ?)
		 ON CONFLICT(id) DO UPDATE SET
		     ciphertext = excluded.ciphertext,
		     version    = account.version + 1,
		     updated_at = excluded.updated_at
		 RETURNING version`,
		id, ciphertext, now).Scan(&version)
	return version, err
}

// DeleteAccount removes the account blob. Idempotent: deleting a nonexistent id
// is not an error (the owner's aliases are separate rows, revoked client-side).
func (s *Store) DeleteAccount(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM account WHERE id = ?`, id)
	return err
}

// GetAccount returns the account blob, its version, and whether it exists.
func (s *Store) GetAccount(ctx context.Context, id string) (ciphertext []byte, version int64, found bool, err error) {
	err = s.db.QueryRowContext(ctx, `SELECT ciphertext, version FROM account WHERE id = ?`, id).
		Scan(&ciphertext, &version)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, 0, false, nil
	}
	if err != nil {
		return nil, 0, false, err
	}
	return ciphertext, version, true, nil
}

// --- Notify routing ---------------------------------------------------------

// PutNotifyRoute maps hash(notify_token) to an opaque routing endpoint.
func (s *Store) PutNotifyRoute(ctx context.Context, tokenHash, routingEndpointID string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO notify_route (token_hash, routing_endpoint_id) VALUES (?, ?)
		 ON CONFLICT(token_hash) DO UPDATE SET routing_endpoint_id = excluded.routing_endpoint_id`,
		tokenHash, routingEndpointID)
	return err
}

// GetNotifyRoute resolves a token hash to its routing endpoint.
func (s *Store) GetNotifyRoute(ctx context.Context, tokenHash string) (routingEndpointID string, found bool, err error) {
	err = s.db.QueryRowContext(ctx, `SELECT routing_endpoint_id FROM notify_route WHERE token_hash = ?`, tokenHash).
		Scan(&routingEndpointID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return routingEndpointID, true, nil
}

// --- Push endpoints ---------------------------------------------------------

// PushTarget is a stored Web Push subscription.
type PushTarget struct {
	Endpoint string
	P256dh   string
	Auth     string
}

// RegisterPush stores (or refreshes) a Web Push subscription for a routing endpoint.
func (s *Store) RegisterPush(ctx context.Context, routingEndpointID string, t PushTarget, now int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO push_endpoint (routing_endpoint_id, endpoint, p256dh, auth, created_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(routing_endpoint_id, endpoint) DO UPDATE SET
		     p256dh = excluded.p256dh, auth = excluded.auth`,
		routingEndpointID, t.Endpoint, t.P256dh, t.Auth, now)
	return err
}

// PushEndpoints returns all subscriptions for a routing endpoint.
func (s *Store) PushEndpoints(ctx context.Context, routingEndpointID string) ([]PushTarget, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT endpoint, p256dh, auth FROM push_endpoint WHERE routing_endpoint_id = ?`, routingEndpointID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PushTarget
	for rows.Next() {
		var t PushTarget
		if err := rows.Scan(&t.Endpoint, &t.P256dh, &t.Auth); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// DistinctPushRoutes returns every routing endpoint that has at least one
// registered push subscription: the cover-broadcast population. A real wake fans
// out one cover to each of these so the recipient is hidden among them (doc 13 §2).
func (s *Store) DistinctPushRoutes(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT DISTINCT routing_endpoint_id FROM push_endpoint`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// --- Send queues ------------------------------------------------------------

// The real wake queue and the cover-broadcast queue are byte-for-byte the same
// shape, so they share one set of enqueue/due/delete helpers keyed by a constant
// table name (never user input, so the fmt.Sprintf carries no injection).
const (
	sendQueueTable  = "send_queue"
	coverQueueTable = "cover_send"
)

// Send is a queued wake job (contentless).
type Send struct {
	ID                int64
	RoutingEndpointID string
}

func (s *Store) enqueueQueued(ctx context.Context, table, routingEndpointID string, availableAt, now int64) error {
	_, err := s.db.ExecContext(ctx,
		fmt.Sprintf(`INSERT INTO %s (routing_endpoint_id, available_at, created_at) VALUES (?, ?, ?)`, table),
		routingEndpointID, availableAt, now)
	return err
}

func (s *Store) dueQueued(ctx context.Context, table string, now int64, limit int) ([]Send, error) {
	rows, err := s.db.QueryContext(ctx,
		fmt.Sprintf(`SELECT id, routing_endpoint_id FROM %s WHERE available_at <= ? ORDER BY available_at LIMIT ?`, table),
		now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Send
	for rows.Next() {
		var s Send
		if err := rows.Scan(&s.ID, &s.RoutingEndpointID); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (s *Store) deleteQueued(ctx context.Context, table string, id int64) error {
	_, err := s.db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM %s WHERE id = ?`, table), id)
	return err
}

// EnqueueSend adds a real wake job to be delivered at or after availableAt.
func (s *Store) EnqueueSend(ctx context.Context, routingEndpointID string, availableAt, now int64) error {
	return s.enqueueQueued(ctx, sendQueueTable, routingEndpointID, availableAt, now)
}

// DueSends returns up to limit real jobs whose time has arrived, oldest first.
func (s *Store) DueSends(ctx context.Context, now int64, limit int) ([]Send, error) {
	return s.dueQueued(ctx, sendQueueTable, now, limit)
}

// DeleteSend removes a real job once its broadcast is scheduled.
func (s *Store) DeleteSend(ctx context.Context, id int64) error {
	return s.deleteQueued(ctx, sendQueueTable, id)
}

// EnqueueCover schedules one cover wake for a routing endpoint within the window.
func (s *Store) EnqueueCover(ctx context.Context, routingEndpointID string, availableAt, now int64) error {
	return s.enqueueQueued(ctx, coverQueueTable, routingEndpointID, availableAt, now)
}

// DueCovers returns up to limit cover wakes whose time has arrived, oldest first.
func (s *Store) DueCovers(ctx context.Context, now int64, limit int) ([]Send, error) {
	return s.dueQueued(ctx, coverQueueTable, now, limit)
}

// DeleteCover removes a delivered cover wake.
func (s *Store) DeleteCover(ctx context.Context, id int64) error {
	return s.deleteQueued(ctx, coverQueueTable, id)
}

// --- Knocks -----------------------------------------------------------------

// RecordKnock records a contentless knock, deduplicated per (target, requester).
// created reports whether a new row was written (an existing, unexpired knock is
// a no-op). The caller equalizes total work regardless of this result.
//
// pubKey is the requester's opaque ephemeral grant key (or "" for a knock that
// only wants the quiet indicator). It is written on the FIRST knock and left
// untouched on a dedup'd repeat (ON CONFLICT DO NOTHING). This assumes a requester
// reuses a stable per-alias key, so the stored value still matches the key it
// holds. The assumption has two known gaps the owner-seal slice must handle: a
// first contentless knock ("") is NOT upgraded by a later keyed re-knock (the
// owner sees ""), and a device that regenerates its key (reinstall) leaves the
// owner sealing to a key the requester no longer holds. Both degrade to "no grant
// arrives", never to a wrong-recipient grant, so failing safe is preserved.
func (s *Store) RecordKnock(ctx context.Context, targetID, requesterHash, pubKey string, now, expiresAt int64) (created bool, err error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO knock (target_id, requester_hash, pub_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(target_id, requester_hash) DO NOTHING`,
		targetID, requesterHash, pubKey, now, expiresAt)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// RecentKnockCount counts a target's knocks created at or after since. The active
// per-(id, requester) knock limit is the in-memory token bucket in the server;
// this is a DB-side helper kept for future per-requester accounting.
func (s *Store) RecentKnockCount(ctx context.Context, targetID string, since int64) (int, error) {
	var n int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM knock WHERE target_id = ? AND created_at >= ?`, targetID, since).Scan(&n)
	return n, err
}

// Knock is one live knock as the owner sees it on review: the opaque requester
// token and the optional ephemeral grant key. Both are opaque to the server.
type Knock struct {
	RequesterHash string
	PubKey        string
}

// CurrentKnocks returns a target's still-live knocks (not yet expired) as of now,
// oldest first, so the OWNER can seal an in-app grant to each requester's key.
// Ordered by created_at for a stable review list; the order carries no identity.
func (s *Store) CurrentKnocks(ctx context.Context, targetID string, now int64) ([]Knock, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT requester_hash, pub_key FROM knock
		 WHERE target_id = ? AND expires_at > ? ORDER BY created_at`, targetID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Knock
	for rows.Next() {
		var k Knock
		if err := rows.Scan(&k.RequesterHash, &k.PubKey); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// VerifyAliasWrite reports whether writeAuth matches the alias's stored write
// token (constant-time). False for both a wrong token and a nonexistent alias,
// so a caller cannot distinguish the two (alias existence stays hidden).
func (s *Store) VerifyAliasWrite(ctx context.Context, id, writeAuth string) (bool, error) {
	var stored string
	switch err := s.db.QueryRowContext(ctx, `SELECT write_auth FROM alias WHERE id = ?`, id).Scan(&stored); {
	case errors.Is(err, sql.ErrNoRows):
		return false, nil
	case err != nil:
		return false, err
	default:
		return subtle.ConstantTimeCompare([]byte(stored), []byte(writeAuth)) == 1, nil
	}
}

// PurgeExpiredKnocks deletes knocks past their expiry and returns how many went.
func (s *Store) PurgeExpiredKnocks(ctx context.Context, now int64) (int64, error) {
	res, err := s.db.ExecContext(ctx, `DELETE FROM knock WHERE expires_at <= ?`, now)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// --- Blind aggregate stats (for system telemetry only) ----------------------
//
// These return aggregate counts and sizes of OPAQUE rows. They name no subject:
// a row count is "how many ciphertext blobs exist", never whose, and the byte
// size is the file, not any value. They back the loopback-only metrics endpoint
// (see labs/docs/12-observability-and-metrics.md); nothing here is ever served
// to a client or attributable to a person, device, or card.

// Stats is a point-in-time snapshot of blind aggregate counts. Every field is a
// count of opaque rows or a file size: no id, token, or value is exposed.
type Stats struct {
	DBSizeBytes         int64 // logical SQLite size (page_count * page_size)
	AliasRows           int64 // distinct alias blobs (rough "passports exist" proxy)
	AccountRows         int64 // distinct account blobs (rough "syncing devices" proxy)
	KnockRows           int64 // live knock rows (auto-expiring)
	SendQueueDepth      int64 // wake jobs awaiting drain
	OldestSendCreatedAt int64 // unix ms of the oldest queued send, 0 if empty
}

// Stats samples the blind aggregate counts in one pass. It is cheap (small COUNTs
// and two pragmas) and intended to be called at metrics-scrape time, not per
// request.
func (s *Store) Stats(ctx context.Context) (Stats, error) {
	var st Stats
	var pageCount, pageSize int64
	if err := s.db.QueryRowContext(ctx, `PRAGMA page_count`).Scan(&pageCount); err != nil {
		return st, err
	}
	if err := s.db.QueryRowContext(ctx, `PRAGMA page_size`).Scan(&pageSize); err != nil {
		return st, err
	}
	st.DBSizeBytes = pageCount * pageSize
	for _, q := range []struct {
		sql string
		dst *int64
	}{
		{`SELECT COUNT(*) FROM alias`, &st.AliasRows},
		{`SELECT COUNT(*) FROM account`, &st.AccountRows},
		{`SELECT COUNT(*) FROM knock`, &st.KnockRows},
		{`SELECT COUNT(*) FROM send_queue`, &st.SendQueueDepth},
		{`SELECT COALESCE(MIN(created_at), 0) FROM send_queue`, &st.OldestSendCreatedAt},
	} {
		if err := s.db.QueryRowContext(ctx, q.sql).Scan(q.dst); err != nil {
			return st, err
		}
	}
	return st, nil
}
