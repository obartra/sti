-- The blind store. Every value is opaque: ciphertext the server can't read, or an
-- opaque routing token. No PII, no social graph. See labs/docs/10-*.md and 09-*.md.

CREATE TABLE IF NOT EXISTS alias (
    id          TEXT PRIMARY KEY,   -- opaque alias id (the only id the server sees)
    ciphertext  BLOB NOT NULL,      -- padded to contract.AliasPayloadSize before storage
    write_auth  TEXT NOT NULL,      -- hash(write token); gates overwrites by non-owners
    updated_at  INTEGER NOT NULL,
    expires_at  INTEGER             -- epoch ms the link stops resolving; NULL = no expiry (doc 16)
) WITHOUT ROWID;

-- The notify inbox: alias-shaped per-device storage for one fixed-size, encrypted,
-- contentless partner-notify ping by opaque id (doc 13). Same blind/existence-
-- uniform read as alias; kept a SEPARATE table so inbox writes never touch card
-- storage and can carry their own metrics/limits.
CREATE TABLE IF NOT EXISTS notify_inbox (
    id          TEXT PRIMARY KEY,   -- opaque inbox id (the recipient's capability)
    ciphertext  BLOB NOT NULL,      -- padded to contract.AliasPayloadSize before storage
    write_auth  TEXT NOT NULL,      -- hash(write token); gates writes to this inbox
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

-- Decorrelation cover broadcast (doc 13 §2). When a real wake comes due the drain
-- fans out one contentless wake per registered push route into here, each at a
-- jittered available_at, so the whole push population wakes and the real recipient
-- is not distinguishable. Same shape as send_queue but never re-triggers a fan-out
-- (the drain reads send_queue, not this, to decide a broadcast), so covers cannot
-- beget covers.
CREATE TABLE IF NOT EXISTS cover_send (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    routing_endpoint_id TEXT NOT NULL,
    available_at        INTEGER NOT NULL,  -- jittered wake time within the window
    created_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cover_send_available ON cover_send (available_at);

-- Vanity name directory (doc 17, Findable mode). Maps an opt-in, human-chosen
-- name to the opaque alias id it points at, and NOTHING else: never a status, a
-- key, or an identity. Resolving a name yields an opaque id the viewer must still
-- knock for. Unlike the existence-uniform alias table, existence here is
-- intentionally revealed (a registered name is discoverable by design); the name
-- and that it is registered are the only thing Findable adds over Gated.
CREATE TABLE IF NOT EXISTS vanity_name (
    name        TEXT PRIMARY KEY,   -- normalized [a-z0-9_]{3,30}
    alias_id    TEXT NOT NULL,      -- the opaque alias the name resolves to
    created_at  INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS knock (
    target_id       TEXT NOT NULL,         -- alias being knocked on
    requester_hash  TEXT NOT NULL,         -- opaque per-requester token
    pub_key         TEXT NOT NULL DEFAULT '', -- opaque ephemeral grant key, or '' (doc 13)
    created_at      INTEGER NOT NULL,
    expires_at      INTEGER NOT NULL,      -- auto-expiry ~4 days
    PRIMARY KEY (target_id, requester_hash)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_knock_expires ON knock (expires_at);

-- Append-only admin action log (doc 20). Records the single shared "admin" role's
-- actions so any use of the operator surface is reconstructable after the fact: a
-- leaked admin secret's misuse is at least auditable. Holds ONLY opaque values:
-- the action name and an opaque target (an id or a vanity name), never any user
-- content (no ciphertext, no plaintext, no status). Rows are never updated and are
-- pruned only by retention, never by an admin action, so the history stays honest.
CREATE TABLE IF NOT EXISTS admin_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,            -- e.g. "ping", "vanity.takedown"
    target      TEXT NOT NULL DEFAULT '', -- opaque id/name, never content
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at);
