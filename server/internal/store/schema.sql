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
    updated_at  INTEGER NOT NULL,
    write_auth  TEXT NOT NULL DEFAULT '', -- hash(account write token); gates overwrite/delete
    last_seen_at INTEGER NOT NULL DEFAULT 0 -- epoch ms of the last read OR write; the janitor
                                            -- deletes a backup left untouched past the inactivity
                                            -- window (data minimization; disclosed in Privacy)
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

-- Sibling-alias decorrelation (doc 11). An owner reporting a result republishes
-- every shared card; submitting them as one batch lets the server APPLY each at an
-- independent jittered time instead of a same-instant client burst, so a downstream
-- observer watching two of the owner's aliases cannot see them change together. A
-- row is an opaque pending alias overwrite (ciphertext + write-auth hash, exactly
-- like the alias table), applied and deleted by the janitor when available_at passes.
CREATE TABLE IF NOT EXISTS republish_queue (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    alias_id     TEXT NOT NULL,         -- the alias to overwrite
    ciphertext   BLOB NOT NULL,         -- padded to contract.AliasPayloadSize
    write_auth   TEXT NOT NULL,         -- hash(write token); gates the deferred write
    available_at INTEGER NOT NULL,      -- jittered apply time (decorrelation)
    created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_republish_available ON republish_queue (available_at);

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
-- A name is in one of two states (doc 17 allocation lifecycle):
--   active:   alias_id != '' and locked_until = 0   -> resolves to alias_id
--   released: alias_id  = '' and locked_until > now  -> the 24h lock; unclaimable
-- After the lock lapses (locked_until <= now) the row is reclaimable first-come.
-- alias_id is the ONLY owning reference: ownership is proven by holding that
-- alias's write token, so no separate owner column is stored.
CREATE TABLE IF NOT EXISTS vanity_name (
    name         TEXT PRIMARY KEY,   -- normalized [a-z0-9_]{3,30}
    alias_id     TEXT NOT NULL,      -- the opaque alias the name resolves to; '' when released
    created_at   INTEGER NOT NULL,
    locked_until INTEGER NOT NULL DEFAULT 0 -- epoch ms; > now => in the post-release lock
) WITHOUT ROWID;
-- Enforce "one active name per alias" (doc 17) without a table scan: a partial
-- index over only the ACTIVE rows (alias_id != ''), the set ClaimVanityName probes
-- before a claim. Released rows (alias_id = '') are excluded, so it stays small.
CREATE INDEX IF NOT EXISTS idx_vanity_alias ON vanity_name (alias_id) WHERE alias_id != '';

-- Password-recovery envelopes (doc 32). One fixed-size opaque blob per owner-chosen
-- locator: the account root wrapped by a memory-hard KDF of the owner's password.
-- The server never sees the password or anything derived from it; it stores bytes
-- and serves them existence-uniformly (a decoy on a miss), so a short, guessable
-- locator is not an existence oracle. write_auth is hash(account write token): the
-- first writer binds it, and only a matching token may overwrite or delete, so no
-- one but the owner can replace or drop someone's envelope. The locator shares the
-- vanity-name charset ([a-z0-9_]{3,30}) but is a SEPARATE namespace: it names an
-- envelope, never a public directory entry, and is validated for shape only.
CREATE TABLE IF NOT EXISTS recovery_envelope (
    locator     TEXT PRIMARY KEY,   -- owner-chosen non-secret name; shape-validated
    ciphertext  BLOB NOT NULL,      -- exactly contract.RecoveryEnvelopeSize bytes (opaque)
    write_auth  TEXT NOT NULL,      -- hash(account write token); gates overwrite/delete
    updated_at  INTEGER NOT NULL
) WITHOUT ROWID;

-- Shared-group blobs (doc 33, slice 2). One fixed-size opaque blob per group,
-- keyed by an opaque group id (like an alias id): the sealed group object (handle,
-- roster of per-member entries, and per-member wrapped group key Kg). The server
-- never learns the group, its members, or any status; it stores bytes and serves
-- them existence-uniformly (a decoy on a miss), so the blob adds NO oracle the alias
-- store does not already have. Same shape as the alias/inbox tables: an admin binds
-- write_auth on the first write, and only a matching token may overwrite or delete
-- (which admin may change the blob). Ciphertext is exactly contract.GroupBlobSize.
CREATE TABLE IF NOT EXISTS group_blob (
    id          TEXT PRIMARY KEY,   -- opaque group id (the only id the server sees)
    ciphertext  BLOB NOT NULL,      -- padded to contract.GroupBlobSize before storage
    write_auth  TEXT NOT NULL,      -- hash(write token); gates overwrite/delete by non-owners
    updated_at  INTEGER NOT NULL
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

-- Reports filed against a vanity name (doc 17 report-and-takedown). Public,
-- unauthenticated intake (rate-limited) creates a row; the admin review queue
-- aggregates them per name. `reason` is one of a fixed, validated set of codes
-- (never free text), so the table holds no user-supplied content. Volume never
-- auto-acts; rows are cleared on takedown or dismiss.
CREATE TABLE IF NOT EXISTS vanity_report (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,   -- the reported normalized vanity name
    reason      TEXT NOT NULL,   -- a fixed reason code (see contract), never free text
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vanity_report_name ON vanity_report (name);

-- "Something wrong?" reports filed through the public in-app form (doc 35). Public,
-- unauthenticated intake (rate-limited) inserts a row; the admin queue reads the
-- rows and the operator resolves one, which deletes it (like a vanity dismiss). This
-- is the ONLY table that holds text a user typed (`body`, an optional note), so it is
-- length-capped at intake and swept by the janitor after a bounded window. Operator-
-- readable by design, never encrypted user content, never a reporter identity.
CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reason      TEXT NOT NULL,            -- a fixed reason code (see contract), validated
    body        TEXT NOT NULL DEFAULT '', -- optional free text, length-capped at intake
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at);
