// Package contract is the single source of truth for the backend's wire format:
// the endpoints, the opaque-id shape, the fixed response sizes that make existence
// undetectable, and the error model. The server and any client honor exactly this.
//
// Design: labs/docs/10-build-backend-and-deployment.md. The server is blind: every
// value below is opaque to it (ciphertext or an opaque routing token), so there is
// no PII or social graph anywhere in this contract.
package contract

import "regexp"

// --- Opaque identifiers -----------------------------------------------------
//
// Ids are URL-safe base64 (no padding) of 32 random bytes (256-bit). They are
// unguessable and collision-free without any server-side registry, which is why
// the server can be a blind key-value store. Encoded length is a fixed 43 chars.

const (
	// IDRandomBytes is the entropy behind every opaque id.
	IDRandomBytes = 32
	// IDEncodedLen is the fixed base64url (unpadded) length of IDRandomBytes.
	IDEncodedLen = 43
)

var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

// ValidID reports whether s is a well-formed opaque id. It does NOT say whether
// the id exists; existence is never revealed (see the sensitive endpoints).
func ValidID(s string) bool { return idPattern.MatchString(s) }

var pubKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

// ValidPubKey reports whether s is a plausible knock grant key: non-empty,
// base64url, and within PubKeyMaxLen. The server treats the bytes as opaque; this
// only bounds storage and rejects junk. An empty string (no grant key) is not
// "valid" here because callers use "" to mean "store no key".
func ValidPubKey(s string) bool {
	return s != "" && len(s) <= PubKeyMaxLen && pubKeyPattern.MatchString(s)
}

// --- Fixed sizes (the existence-hiding knobs) -------------------------------

const (
	// AliasPayloadSize is the single fixed wire size of every GET /a response.
	// Real ciphertext is padded to it and decoys are generated at it, so response
	// length never distinguishes a real alias from a decoy or from another user's.
	AliasPayloadSize = 4096

	// AccountBlobMaxSize caps the device-sync blob (not existence-sensitive; the
	// account id is derived from the owner's own key).
	AccountBlobMaxSize = 1 << 20 // 1 MiB

	// RecoveryEnvelopeSize is the single fixed wire size of every recovery-envelope
	// PUT body and GET response (doc 32). The client frames its envelope (KDF params,
	// salt, wrapped root) and pads to exactly this, so the server stores and serves a
	// constant-size opaque blob and can return a decoy of the SAME length on a miss.
	// That makes a real envelope and a "no such locator" byte-identical on the wire,
	// so the store is not an existence oracle for a (guessable, human-chosen) locator.
	// 256 bytes comfortably holds the ~90-byte envelope with headroom for future
	// params/versions without another size migration.
	RecoveryEnvelopeSize = 256
)

// --- Endpoints --------------------------------------------------------------

const (
	PathAliasPrefix    = "/a/"            // GET: resolve an alias (hot read)
	PathInboxPrefix    = "/inbox/"        // GET/PUT: per-device notify inbox (alias-shaped)
	PathAccountPrefix  = "/acct/"         // GET/PUT: device-sync blob
	PathNotify         = "/notify"        // POST: enqueue a contentless wake
	PathRepublish      = "/republish"     // POST: deferred jittered batch of alias overwrites
	PathPushRegister   = "/push/register" // POST: register a Web Push endpoint
	PathKnockPrefix    = "/knock/"        // POST: contentless knock
	PathVanityPrefix   = "/u/"            // GET resolve; PUT register / DELETE release (gated)
	PathRecoveryPrefix = "/recovery/"     // GET fetch / PUT store / DELETE drop a password envelope (doc 32, gated)
	PathHealth         = "/healthz"       // GET: liveness
	PathVapid          = "/vapid"         // GET: the active Web Push public key

	// The operator surface (doc 20). Bearer + flag gated, rate-limited, audited.
	// Registered only when admin is enabled; otherwise these paths are a bare 404,
	// so the surface is invisible by default.
	PathAdminPrefix  = "/admin/"        // all admin endpoints share this prefix
	PathAdminPing    = "/admin/ping"    // GET: 204 if the admin bearer token is valid
	PathAdminReports = "/admin/reports" // GET: the vanity-name review queue (doc 17/20)
	PathAdminAudit   = "/admin/audit"   // GET: recent admin actions, newest first (doc 20 A4)
	PathAdminMetrics = "/admin/metrics" // GET: aggregate, identifier-free service totals (doc 20 A5)
)

// --- JSON bodies (only the non-byte endpoints) ------------------------------

// NotifyRequest enqueues a contentless wake for a pairwise notify token. The
// server resolves hash(notify_token) to a routing endpoint; it never sees the
// token itself or who is notifying whom.
type NotifyRequest struct {
	TokenHash string `json:"tokenHash"`
}

// RepublishMaxOps caps a single decorrelation batch. Comfortably above any real
// owner's alias count; a larger batch is a 400, never a silent truncation.
const RepublishMaxOps = 256

// RepublishOp is one alias overwrite in a decorrelation batch (doc 11). Ciphertext
// is standard-base64 of exactly AliasPayloadSize bytes (the same fixed-size sealed
// card a direct PUT /a carries); WriteToken gates the write exactly like PUT /a. A
// batch never changes link expiry (that is only ever a single-alias action), so
// there is no expiry field: the deferred write preserves the alias's current expiry.
type RepublishOp struct {
	ID         string `json:"id"`
	Ciphertext string `json:"ciphertext"`
	WriteToken string `json:"writeToken"`
}

// RepublishRequest is a batch of alias overwrites the owner hands the server to
// apply at INDEPENDENT jittered times, so the public card updates do not land in one
// correlatable burst (sibling-alias decorrelation, doc 11). The server learns the
// grouping (it received the batch) but it is the blind-trusted party; what a
// downstream observer watching the alias reads sees is decorrelated.
type RepublishRequest struct {
	Ops []RepublishOp `json:"ops"`
}

// VapidResponse carries the server's active Web Push (VAPID) public key, which a
// browser needs to subscribe. PublicKey is empty when push is not configured, which
// the client reads as "push unavailable". Public and cacheable; reveals nothing.
type VapidResponse struct {
	PublicKey string `json:"publicKey"`
}

// PushRegisterRequest binds a Web Push subscription to an opaque routing endpoint.
type PushRegisterRequest struct {
	RoutingEndpointID string           `json:"routingEndpointId"`
	Subscription      PushSubscription `json:"subscription"`
}

// PushSubscription is the standard Web Push subscription shape (opaque to us).
type PushSubscription struct {
	Endpoint string              `json:"endpoint"`
	Keys     PushSubscriptionKey `json:"keys"`
}

type PushSubscriptionKey struct {
	P256dh string `json:"p256dh"`
	Auth   string `json:"auth"`
}

// KnockRequest carries the opaque per-requester token (computed client-side) so
// knocks can be deduped and rate-limited per requester. It names no one.
//
// PubKey is an optional per-requester ephemeral public key (raw P-256 point,
// base64url) the requester keeps the private half of locally. It lets the owner
// seal an in-app grant TO that key (doc 13, slice 2) without the server ever
// learning the key's meaning: to the server it is opaque bytes, like any other
// stored value. Omitted by clients that only want the contentless knock.
type KnockRequest struct {
	RequesterHash string `json:"requesterHash"`
	PubKey        string `json:"pubKey,omitempty"`
}

// PubKeyMaxLen bounds a knock's PubKey. A raw uncompressed P-256 point is 65
// bytes, which is 88 base64url chars; the cap leaves a little slack and keeps a
// rogue client from parking large blobs on the contentless knock path. An
// over-long or malformed key is dropped (the knock still succeeds uniformly), so
// this never becomes a distinguishing rejection.
const PubKeyMaxLen = 128

// PendingKnock is one live knock as the alias OWNER sees it on review: the opaque
// per-requester token plus the optional ephemeral key to seal a grant to. It
// still names no one; both fields are opaque to the server.
type PendingKnock struct {
	RequesterHash string `json:"requesterHash"`
	PubKey        string `json:"pubKey,omitempty"`
}

// KnockResponse is the ONLY response POST /knock ever returns, byte-identical for
// real, fake, guessed, and over-limit ids, so a knock reveals nothing about
// whether the alias exists.
type KnockResponse struct {
	Status string `json:"status"`
}

// KnockReviewResponse is what GET /knock/{id} returns to the alias OWNER (who
// proves ownership with the write token): the count of current knocks on that
// alias, plus the opaque pending tokens needed to grant access. It names no
// requester (a requesterHash is a hash, not an identity) and carries no per-knock
// timing; it is the owner-pull "quiet indicator" (doc 02), never pushed. Pending
// lets the owner seal an in-app grant to each waiting requester's PubKey (doc 13,
// slice 2); Count stays as the cheap badge and equals len(Pending).
type KnockReviewResponse struct {
	Count   int            `json:"count"`
	Pending []PendingKnock `json:"pending,omitempty"`
}

// VanityRegisterRequest is the body of PUT /u/{name} (doc 17, Findable): the
// opaque alias id the name should resolve to. The requester proves they own that
// alias with its write token (X-Write-Token header); the server stores only the
// name -> aliasId mapping, never a status, key, or identity.
type VanityRegisterRequest struct {
	AliasID string `json:"aliasId"`
}

// VanityResolveResponse is GET /u/{name}'s body when the name is registered: the
// opaque alias id the viewer then knocks on (doc 17, Findable). The server
// returns ONLY the id, never a status, key, or identity. A missing name is a bare
// 404 (no body); existence is intentionally non-uniform here, unlike GET /a.
type VanityResolveResponse struct {
	AliasID string `json:"aliasId"`
}

// Vanity report reason codes (doc 17 report-and-takedown). A FIXED set, so the
// report store never holds free-form user text. The client report form maps to
// exactly these; the server rejects anything else.
const (
	ReportImpersonation = "impersonation"
	ReportAbuse         = "abuse"
	ReportSlur          = "slur"
	ReportSpam          = "spam"
	ReportOther         = "other"
)

var reportReasons = map[string]struct{}{
	ReportImpersonation: {}, ReportAbuse: {}, ReportSlur: {}, ReportSpam: {}, ReportOther: {},
}

// ValidReportReason reports whether r is one of the fixed reason codes.
func ValidReportReason(r string) bool {
	_, ok := reportReasons[r]
	return ok
}

// VanityReportRequest is the body of POST /u/{name}/report: a fixed reason code.
// The endpoint is public + rate-limited; the report record names no reporter.
type VanityReportRequest struct {
	Reason string `json:"reason"`
}

// AdminReport is one entry in the admin review queue (GET /admin/reports): a
// reported name, its report count, the most recent reason, and when it was first
// reported. The name is public and the reason is a fixed code; nothing here is
// user content or a reporter identity.
type AdminReport struct {
	Name      string `json:"name"`
	Reason    string `json:"reason"`
	Count     int    `json:"count"`
	CreatedAt int64  `json:"createdAt"`
}

// AdminReportsResponse is GET /admin/reports' body.
type AdminReportsResponse struct {
	Reports []AdminReport `json:"reports"`
}

// AdminAuditEntry is one recorded admin action (GET /admin/audit, doc 20 A4): the
// monotonic row id (the "load older" cursor), the fixed action verb, the opaque
// target (an id or a public name), and when it ran. Never user content; the audit
// log carries none to begin with.
type AdminAuditEntry struct {
	ID        int64  `json:"id"`
	Action    string `json:"action"`
	Target    string `json:"target"`
	CreatedAt int64  `json:"createdAt"`
}

// AdminAuditResponse is GET /admin/audit's body: recent actions, newest first.
type AdminAuditResponse struct {
	Entries []AdminAuditEntry `json:"entries"`
}

// AdminMetricsResponse is GET /admin/metrics' body (doc 20 A5): aggregate,
// identifier-free service totals for the operator dashboard. Every field is a count
// of opaque rows or a system size, never a per-account or per-id figure and never a
// distribution that could fingerprint one account, so it stays within the
// blind-store boundary (doc 12). A read, so it is not itself audited.
type AdminMetricsResponse struct {
	Accounts       int64 `json:"accounts"`       // distinct account-sync blobs
	Aliases        int64 `json:"aliases"`        // distinct alias (live-link) ciphertext rows
	Knocks         int64 `json:"knocks"`         // live knock rows (auto-expiring)
	SendQueueDepth int64 `json:"sendQueueDepth"` // wake jobs awaiting drain
	DBSizeBytes    int64 `json:"dbSizeBytes"`    // logical database size
	PendingReports int   `json:"pendingReports"` // names awaiting review in the queue
}

// AdminRecordInfo is opaque metadata about one stored record (doc 20 A3): whether
// it exists, its ciphertext byte size, and when it was last written. Never any
// content.
type AdminRecordInfo struct {
	Exists    bool  `json:"exists"`
	SizeBytes int64 `json:"sizeBytes"`
	UpdatedAt int64 `json:"updatedAt"`
}

// AdminLookupResponse is GET /admin/lookup/{id}'s body: opaque metadata for the id
// across the record namespaces it could belong to. At most one is present.
type AdminLookupResponse struct {
	Alias   AdminRecordInfo `json:"alias"`
	Account AdminRecordInfo `json:"account"`
	Inbox   AdminRecordInfo `json:"inbox"`
}

// HeaderWriteToken authorizes a PUT to an alias. The owner holds it; viewers get
// only the read id in the URL, so they can resolve an alias but never overwrite
// it. The server stores hash(token) on first write and requires a match after.
const HeaderWriteToken = "X-Write-Token"

// HeaderVersion carries the account-blob version on sync reads/writes.
const HeaderVersion = "X-Version"

// HeaderExpiresAt sets a link's server-enforced expiry on an alias PUT (doc 16):
// an absolute epoch-ms instant after which reads return a decoy, the value
// "none" to clear any expiry, or absent to leave the stored expiry untouched (a
// badge-driven republish). The server reads only this one time value per alias.
const HeaderExpiresAt = "X-Expires-At"

// ExpiresAtNone is the HeaderExpiresAt value that explicitly clears an expiry
// (distinct from omitting the header, which preserves the stored one).
const ExpiresAtNone = "none"

// KnockStatus is the single fixed value of KnockResponse.Status.
const KnockStatus = "received"

// ErrorResponse is returned ONLY by non-sensitive endpoints. The existence-
// sensitive endpoints (GET /a, POST /knock) never return a distinguishing error
// or status code; they ride the uniform path instead.
type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Stable error codes (non-sensitive endpoints only).
const (
	ErrBadRequest   = "bad_request"
	ErrTooLarge     = "payload_too_large"
	ErrRateLimited  = "rate_limited"
	ErrInternal     = "internal"
	ErrNotFound     = "not_found" // never used on /a or /knock
	ErrUnsupported  = "unsupported_media_type"
	ErrMethodNotOk  = "method_not_allowed"
	ErrUnauthorized = "unauthorized"       // admin bearer missing or wrong (doc 20)
	ErrVanityTaken  = "vanity_unavailable" // a vanity name is reserved, blocked, taken, or locked (doc 17)
	ErrConflict     = "conflict"           // an account PUT lost an optimistic-concurrency race (doc 22 S8)
)
