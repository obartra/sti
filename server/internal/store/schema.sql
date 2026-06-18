-- The blind store. Every value is opaque: ciphertext the server can't read, or an
-- opaque routing token. No PII, no social graph. See labs/docs/10-*.md and 09-*.md.

CREATE TABLE IF NOT EXISTS alias (
    id          TEXT PRIMARY KEY,   -- opaque alias id (the only id the server sees)
    ciphertext  BLOB NOT NULL,      -- padded to contract.AliasPayloadSize before storage
    write_auth  TEXT NOT NULL,      -- hash(write token); gates overwrites by non-owners
    updated_at  INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS account (
    id          TEXT PRIMARY KEY,   -- opaque, derived from the owner's own key
    ciphertext  BLOB NOT NULL,
    version     INTEGER NOT NULL,   -- bumped on every write (reserved for later If-Match)
    updated_at  INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS notify_route (
    token_hash          TEXT PRIMARY KEY,  -- hash(notify_token), exchanged phone-to-phone
    routing_endpoint_id TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS push_endpoint (
    routing_endpoint_id TEXT NOT NULL,
    endpoint            TEXT NOT NULL,     -- Web Push endpoint URL (opaque to us)
    p256dh              TEXT NOT NULL,
    auth                TEXT NOT NULL,
    created_at          INTEGER NOT NULL,
    PRIMARY KEY (routing_endpoint_id, endpoint)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS send_queue (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    routing_endpoint_id TEXT NOT NULL,
    available_at        INTEGER NOT NULL,  -- jittered send time (cross-user timing)
    created_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_send_queue_available ON send_queue (available_at);

CREATE TABLE IF NOT EXISTS knock (
    target_id       TEXT NOT NULL,         -- alias being knocked on
    requester_hash  TEXT NOT NULL,         -- opaque per-requester token
    created_at      INTEGER NOT NULL,
    expires_at      INTEGER NOT NULL,      -- auto-expiry ~4 days
    PRIMARY KEY (target_id, requester_hash)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_knock_expires ON knock (expires_at);
