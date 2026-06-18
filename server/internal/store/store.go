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
	return &Store{db: db}, nil
}

// Close releases the database handle.
func (s *Store) Close() error { return s.db.Close() }

// --- Alias (the hot read) ---------------------------------------------------

// WriteAlias creates an alias (recording writeAuth as its capability) or, if it
// already exists, overwrites it only when writeAuth matches the stored one.
// authorized=false means the id exists but the caller doesn't hold its write
// token. Done in a transaction so concurrent first-writers can't race.
func (s *Store) WriteAlias(ctx context.Context, id string, ciphertext []byte, writeAuth string, now int64) (authorized bool, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var existing string
	switch err := tx.QueryRowContext(ctx, `SELECT write_auth FROM alias WHERE id = ?`, id).Scan(&existing); {
	case errors.Is(err, sql.ErrNoRows):
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO alias (id, ciphertext, write_auth, updated_at) VALUES (?, ?, ?, ?)`,
			id, ciphertext, writeAuth, now); err != nil {
			return false, err
		}
	case err != nil:
		return false, err
	default:
		// Constant-time compare of the stored vs candidate token hash.
		if subtle.ConstantTimeCompare([]byte(existing), []byte(writeAuth)) != 1 {
			return false, nil
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE alias SET ciphertext = ?, updated_at = ? WHERE id = ?`,
			ciphertext, now, id); err != nil {
			return false, err
		}
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

// GetAlias returns the stored payload and whether it exists. Callers MUST NOT
// turn found=false into a distinguishable response (see the decoy rule).
func (s *Store) GetAlias(ctx context.Context, id string) (ciphertext []byte, found bool, err error) {
	err = s.db.QueryRowContext(ctx, `SELECT ciphertext FROM alias WHERE id = ?`, id).Scan(&ciphertext)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return ciphertext, true, nil
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

// --- Send queue -------------------------------------------------------------

// Send is a queued wake job (contentless).
type Send struct {
	ID                int64
	RoutingEndpointID string
}

// EnqueueSend adds a wake job to be delivered at or after availableAt.
func (s *Store) EnqueueSend(ctx context.Context, routingEndpointID string, availableAt, now int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO send_queue (routing_endpoint_id, available_at, created_at) VALUES (?, ?, ?)`,
		routingEndpointID, availableAt, now)
	return err
}

// DueSends returns up to limit jobs whose time has arrived, oldest first.
func (s *Store) DueSends(ctx context.Context, now int64, limit int) ([]Send, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, routing_endpoint_id FROM send_queue WHERE available_at <= ? ORDER BY available_at LIMIT ?`,
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

// DeleteSend removes a delivered job.
func (s *Store) DeleteSend(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM send_queue WHERE id = ?`, id)
	return err
}

// --- Knocks -----------------------------------------------------------------

// RecordKnock records a contentless knock, deduplicated per (target, requester).
// created reports whether a new row was written (an existing, unexpired knock is
// a no-op). The caller equalizes total work regardless of this result.
func (s *Store) RecordKnock(ctx context.Context, targetID, requesterHash string, now, expiresAt int64) (created bool, err error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO knock (target_id, requester_hash, created_at, expires_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(target_id, requester_hash) DO NOTHING`,
		targetID, requesterHash, now, expiresAt)
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

// PurgeExpiredKnocks deletes knocks past their expiry and returns how many went.
func (s *Store) PurgeExpiredKnocks(ctx context.Context, now int64) (int64, error) {
	res, err := s.db.ExecContext(ctx, `DELETE FROM knock WHERE expires_at <= ?`, now)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
