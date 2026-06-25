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
	// alias.expires_at: server-enforced link expiry (doc 16). Older databases have
	// an alias table without it; add it in place (NULL = no expiry).
	hasExpiry, err := hasColumn(ctx, db, "alias", "expires_at")
	if err != nil {
		return err
	}
	if !hasExpiry {
		if _, err := db.ExecContext(ctx,
			`ALTER TABLE alias ADD COLUMN expires_at INTEGER`); err != nil {
			return fmt.Errorf("add alias.expires_at: %w", err)
		}
	}
	// vanity_name.locked_until: the post-release 24h lock (doc 17, Findable F2).
	// Older databases have the F1 vanity_name without it; add it in place (0 = not
	// locked).
	hasLock, err := hasColumn(ctx, db, "vanity_name", "locked_until")
	if err != nil {
		return err
	}
	if !hasLock {
		if _, err := db.ExecContext(ctx,
			`ALTER TABLE vanity_name ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0`); err != nil {
			return fmt.Errorf("add vanity_name.locked_until: %w", err)
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
// Aliases carry a server-enforced expiry (doc 16), so this is its own path rather
// than the shared writeFixed/getFixed (which the notify inbox still uses).
//
// `setExpiry` distinguishes "the caller stated an expiry" (a fresh publish or a
// duration change) from "the caller left it alone" (a badge-driven republish): on
// an overwrite, expires_at is only touched when setExpiry is true, so republishing
// a card never resets a link's lifetime. On a first insert the stated expiry (or
// NULL when unstated / `expiresAt` invalid) is recorded.
func (s *Store) WriteAlias(ctx context.Context, id string, ciphertext []byte, writeAuth string, now int64, expiresAt sql.NullInt64, setExpiry bool) (authorized bool, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var existing string
	switch err := tx.QueryRowContext(ctx, "SELECT write_auth FROM alias WHERE id = ?", id).Scan(&existing); {
	case errors.Is(err, sql.ErrNoRows):
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO alias (id, ciphertext, write_auth, updated_at, expires_at) VALUES (?, ?, ?, ?, ?)",
			id, ciphertext, writeAuth, now, expiresAt); err != nil {
			return false, err
		}
	case err != nil:
		return false, err
	default:
		if subtle.ConstantTimeCompare([]byte(existing), []byte(writeAuth)) != 1 {
			return false, nil
		}
		if setExpiry {
			if _, err := tx.ExecContext(ctx,
				"UPDATE alias SET ciphertext = ?, updated_at = ?, expires_at = ? WHERE id = ?",
				ciphertext, now, expiresAt, id); err != nil {
				return false, err
			}
		} else if _, err := tx.ExecContext(ctx,
			"UPDATE alias SET ciphertext = ?, updated_at = ? WHERE id = ?",
			ciphertext, now, id); err != nil {
			return false, err
		}
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

// GetAlias returns the stored payload, its expiry (Invalid = no expiry), and
// whether it exists. Callers MUST NOT turn found=false (or an expired link) into a
// distinguishable response; the alias read handler returns a decoy for both.
func (s *Store) GetAlias(ctx context.Context, id string) (ciphertext []byte, expiresAt sql.NullInt64, found bool, err error) {
	err = s.db.QueryRowContext(ctx, "SELECT ciphertext, expires_at FROM alias WHERE id = ?", id).
		Scan(&ciphertext, &expiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sql.NullInt64{}, false, nil
	}
	if err != nil {
		return nil, sql.NullInt64{}, false, err
	}
	return ciphertext, expiresAt, true, nil
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

// --- Vanity name directory (doc 17, Findable) -------------------------------
// name -> alias_id only. No status, key, or identity. The endpoints are gated
// behind STI_FINDABLE_ENABLED; ownership of a name is proven by holding the write
// token of the alias it points at (no separate owner record).

// VanityStatus is the outcome of a claim attempt.
type VanityStatus int

const (
	// VanityClaimed: the name now points at the requested alias (a fresh claim, a
	// reclaim of a lapsed-lock name, or an idempotent re-claim by the same alias).
	VanityClaimed VanityStatus = iota
	// VanityTaken: the name is actively held by a DIFFERENT alias (first-come).
	VanityTaken
	// VanityLocked: the name is in its post-release 24h lock, unclaimable by anyone.
	VanityLocked
)

// ClaimVanityName attempts to register name -> aliasID first-come (doc 17). The
// caller MUST have already proven the requester owns aliasID (the alias write
// token); this enforces only the allocation rules. It is transactional so two
// racing first-claims serialize: one wins, the other sees VanityTaken.
func (s *Store) ClaimVanityName(ctx context.Context, name, aliasID string, now int64) (VanityStatus, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return VanityTaken, err
	}
	defer tx.Rollback()

	var existingAlias string
	var lockedUntil int64
	switch err := tx.QueryRowContext(ctx,
		`SELECT alias_id, locked_until FROM vanity_name WHERE name = ?`, name).
		Scan(&existingAlias, &lockedUntil); {
	case errors.Is(err, sql.ErrNoRows):
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO vanity_name (name, alias_id, created_at, locked_until) VALUES (?, ?, ?, 0)`,
			name, aliasID, now); err != nil {
			return VanityTaken, err
		}
	case err != nil:
		return VanityTaken, err
	default:
		switch {
		case existingAlias == aliasID:
			// Idempotent re-claim by the same alias: nothing to change (created_at and
			// the registration stand). Reaches here only because the caller proved it
			// owns aliasID, so this is the genuine holder refreshing.
			return VanityClaimed, tx.Commit()
		case existingAlias != "":
			return VanityTaken, nil // held by a different alias
		case lockedUntil > now:
			return VanityLocked, nil // released but still in the lock window
		default:
			// Released and the lock has lapsed: reclaimable first-come.
			if _, err := tx.ExecContext(ctx,
				`UPDATE vanity_name SET alias_id = ?, created_at = ?, locked_until = 0 WHERE name = ?`,
				aliasID, now, name); err != nil {
				return VanityTaken, err
			}
		}
	}
	return VanityClaimed, tx.Commit()
}

// ResolveVanityName returns the alias id an ACTIVE name points at, and whether it
// is active. A released/locked name (alias_id = ”) resolves as not-found, so a
// name in its lock window stops resolving immediately. Existence is intentionally
// non-uniform here (doc 17): a miss is a real "not found", unlike the alias read.
func (s *Store) ResolveVanityName(ctx context.Context, name string) (aliasID string, found bool, err error) {
	err = s.db.QueryRowContext(ctx,
		`SELECT alias_id FROM vanity_name WHERE name = ? AND alias_id != ''`, name).Scan(&aliasID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return aliasID, true, nil
}

// ReleaseVanityName frees a name into the post-release lock (doc 17): it clears
// the alias mapping (so the name stops resolving at once) and sets locked_until to
// now+lockMs, during which the name is unclaimable. Idempotent (a missing name is
// a no-op). The owner check is the caller's job; this is also the takedown path an
// admin action reuses. Re-locking an already-locked name simply extends the lock.
func (s *Store) ReleaseVanityName(ctx context.Context, name string, now, lockMs int64) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE vanity_name SET alias_id = '', locked_until = ? WHERE name = ?`,
		now+lockMs, name)
	return err
}

// --- Vanity reports (doc 17 report-and-takedown; backs admin A2) -------------

// VanityReport is one row of the admin review queue: a reported name aggregated
// across its pending reports. reason is the most recent report's reason code,
// count is how many reports the name has, and createdAt is when it was first
// reported. All fields are opaque/operational: the name is public, the reason is
// a fixed code, and no reporter identity is stored.
type VanityReport struct {
	Name      string
	Reason    string
	Count     int
	CreatedAt int64
}

// AddVanityReport records one report against a name. reason is a fixed code the
// caller has already validated. Append-only; cleared as a set on takedown/dismiss.
func (s *Store) AddVanityReport(ctx context.Context, name, reason string, now int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO vanity_report (name, reason, created_at) VALUES (?, ?, ?)`,
		name, reason, now)
	return err
}

// PendingVanityReports returns the review queue: one row per reported name with
// its report count, first-reported time, and most recent reason, busiest first.
//
// Only names that are CURRENTLY registered are surfaced (alias_id != ”, the same
// predicate ResolveVanityName uses). A report whose name no longer resolves (it was
// released, taken down, or never existed) is not actionable, so it stays in the
// table but never reaches the reviewer. Intake is existence-uniform on purpose, so
// this read-side filter is where orphan reports are dropped, not at write time.
func (s *Store) PendingVanityReports(ctx context.Context, limit int) ([]VanityReport, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT name, COUNT(*) AS cnt, MIN(created_at) AS first_at,
		        (SELECT reason FROM vanity_report r2 WHERE r2.name = r1.name ORDER BY r2.id DESC LIMIT 1)
		 FROM vanity_report r1
		 WHERE EXISTS (
		     SELECT 1 FROM vanity_name v WHERE v.name = r1.name AND v.alias_id != ''
		 )
		 GROUP BY name
		 ORDER BY cnt DESC, first_at ASC
		 LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []VanityReport
	for rows.Next() {
		var v VanityReport
		if err := rows.Scan(&v.Name, &v.Count, &v.CreatedAt, &v.Reason); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ClearVanityReports drops all reports for a name (on takedown or dismiss).
// Idempotent: clearing a name with no reports is a no-op.
func (s *Store) ClearVanityReports(ctx context.Context, name string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM vanity_report WHERE name = ?`, name)
	return err
}

// --- Admin record management (doc 20 A3) ------------------------------------
//
// Operator actions on server-side records, within the blind-store boundary: they
// delete/revoke OPAQUE rows and read OPAQUE metadata (sizes, timestamps), never
// any plaintext. The admin secret unlocks no content; these can't either.

// AdminDeleteAlias force-removes an alias row regardless of its write token (the
// operator has no token; authority is the admin bearer). After this the id reads
// back as a decoy, exactly like a never-existed id, so a revoked alias stops
// resolving. Idempotent: deleting a missing id is a no-op.
func (s *Store) AdminDeleteAlias(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM alias WHERE id = ?`, id)
	return err
}

// ReleaseVanityNamesForAlias frees every vanity name pointing at aliasID into the
// post-release lock (doc 17), so revoking an alias also stops its name(s)
// resolving and holds them through the lock window. Idempotent.
func (s *Store) ReleaseVanityNamesForAlias(ctx context.Context, aliasID string, now, lockMs int64) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE vanity_name SET alias_id = '', locked_until = ? WHERE alias_id = ?`,
		now+lockMs, aliasID)
	return err
}

// RecordInfo is opaque metadata about a stored record: whether it exists, its
// ciphertext byte size, and when it was last written. No content, ever.
type RecordInfo struct {
	Exists    bool
	SizeBytes int64
	UpdatedAt int64
}

// RecordMeta is what an opaque-id lookup returns across the record namespaces an
// id could belong to. An id is unguessable and namespace-specific in practice, so
// at most one of these is present; reporting all three keeps the lookup one call.
type RecordMeta struct {
	Alias   RecordInfo
	Account RecordInfo
	Inbox   RecordInfo
}

// LookupRecord reports opaque metadata for an id across the alias, account, and
// notify-inbox tables. It selects only length(ciphertext) and updated_at, never
// the ciphertext, so it stays strictly within the blind-store boundary.
func (s *Store) LookupRecord(ctx context.Context, id string) (RecordMeta, error) {
	var m RecordMeta
	for _, q := range []struct {
		sql string
		dst *RecordInfo
	}{
		{`SELECT length(ciphertext), updated_at FROM alias WHERE id = ?`, &m.Alias},
		{`SELECT length(ciphertext), updated_at FROM account WHERE id = ?`, &m.Account},
		{`SELECT length(ciphertext), updated_at FROM notify_inbox WHERE id = ?`, &m.Inbox},
	} {
		switch err := s.db.QueryRowContext(ctx, q.sql, id).
			Scan(&q.dst.SizeBytes, &q.dst.UpdatedAt); {
		case errors.Is(err, sql.ErrNoRows):
			// leave Exists=false
		case err != nil:
			return RecordMeta{}, err
		default:
			q.dst.Exists = true
		}
	}
	return m, nil
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

// --- Admin audit log (doc 20) -----------------------------------------------
//
// Append-only record of every admin action. The store never reads user content,
// so neither does the audit: action is a fixed verb and target is an opaque id or
// vanity name. Backs the operator surface's "this is reconstructable" guarantee.

// AuditEntry is one recorded admin action, newest-first when listed.
type AuditEntry struct {
	Action    string
	Target    string
	CreatedAt int64
}

// AppendAudit records one admin action. Append-only: callers never update or
// delete rows. target is opaque (an id or a name) and MUST NOT carry user content.
func (s *Store) AppendAudit(ctx context.Context, action, target string, now int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO admin_audit (action, target, created_at) VALUES (?, ?, ?)`,
		action, target, now)
	return err
}

// RecentAudits returns the most recent admin actions, newest first, up to limit.
// Backs the admin "recent activity" view and the audit tests. id is monotonic, so
// ordering by it is a stable proxy for time even when two rows share a timestamp.
func (s *Store) RecentAudits(ctx context.Context, limit int) ([]AuditEntry, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT action, target, created_at FROM admin_audit ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AuditEntry
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.Action, &e.Target, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
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
