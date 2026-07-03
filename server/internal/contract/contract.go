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

	// GroupBlobSize is the single fixed wire size of every group-blob PUT body and
	// GET response (doc 33, shared groups). A group object is one sealed blob that
	// holds the group handle plus a roster of per-member entries (each an opaque
	// group-card id, the wrapped group key Kg for that member, and an admin flag).
	// The server stores and serves a constant-size opaque blob and returns a decoy
	// of the SAME length on a miss, so a stored group and a never-written id are
	// byte-identical on the wire: the blob is not an existence oracle (the doc 33
	// "no new oracle" rule). It is stored and read EXACTLY like an alias payload,
	// just at its own size.
	//
	// 16 KiB is sized for EVENT-sized groups: tens of members. A roster entry is on
	// the order of ~150 bytes (an opaque id plus a wrapped key), so this comfortably
	// holds up to roughly a hundred members with header/AEAD-framing headroom. This
	// is a SOFT cap, not built for thousands (doc 33 corner cases: N reads per roster
	// refresh, N republishes per rotation, fine at event scale). A group that outgrows
	// it needs a size migration, exactly like AliasPayloadSize/RecoveryEnvelopeSize.
	GroupBlobSize = 16384
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
	PathGroupPrefix    = "/g/"            // GET resolve / PUT store / DELETE drop a shared-group blob (doc 33, gated)
	PathHealth         = "/healthz"       // GET: liveness
	PathVapid          = "/vapid"         // GET: the active Web Push public key
	PathFeedback       = "/feedback"      // POST: file a "Something wrong?" report (doc 35, public)

	// The operator surface (doc 20). Bearer + flag gated, rate-limited, audited.
	// Registered only when admin is enabled; otherwise these paths are a bare 404,
	// so the surface is invisible by default.
	PathAdminPrefix   = "/admin/"         // all admin endpoints share this prefix
	PathAdminPing     = "/admin/ping"     // GET: 204 if the admin bearer token is valid
	PathAdminReports  = "/admin/reports"  // GET: the vanity-name review queue (doc 17/20)
	PathAdminAudit    = "/admin/audit"    // GET: recent admin actions, newest first (doc 20 A4)
	PathAdminMetrics  = "/admin/metrics"  // GET: aggregate, identifier-free service totals (doc 20 A5)
	PathAdminHealth   = "/admin/health"   // GET: aggregate operational-health signals (doc 20)
	PathAdminTrends   = "/admin/trends"   // GET: aggregate per-day trends + review latency (doc 20)
	PathAdminFeedback = "/admin/feedback" // GET: the "Something wrong?" review queue (doc 35)
	PathAdminLogs     = "/admin/logs"     // GET: the service's recent log lines (doc 20)
	PathAdminRestart  = "/admin/restart"  // POST: audited graceful self-restart (doc 20)
	PathAdminErrors   = "/admin/errors"   // GET: per-day internal-error counts + lifetime totals (doc 20)
	PathAdminPerf     = "/admin/perf"     // GET: requests per day + request-latency histogram (doc 20)
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

// Feedback reason codes for the "Something wrong?" form (doc 35). A FIXED set, like
// the vanity report reasons; the optional free-text note travels separately and is
// length-capped. The client form maps to exactly these; the server rejects anything
// else.
const (
	FeedbackBroken    = "broken"
	FeedbackConfusing = "confusing"
	FeedbackSafety    = "safety"
	FeedbackIdea      = "idea"
	FeedbackQuestion  = "question"
	FeedbackOther     = "other"
)

var feedbackReasons = map[string]struct{}{
	FeedbackBroken: {}, FeedbackConfusing: {}, FeedbackSafety: {},
	FeedbackIdea: {}, FeedbackQuestion: {}, FeedbackOther: {},
}

// ValidFeedbackReason reports whether r is one of the fixed feedback reason codes.
func ValidFeedbackReason(r string) bool {
	_, ok := feedbackReasons[r]
	return ok
}

// Feedback topics: which open question (labs.sti.care/docs/open-questions) a
// "question" response addresses. A FIXED set like the reasons, semantic rather
// than numbered so the doc can renumber without breaking stored rows; empty
// means the response names no particular question.
var feedbackTopics = map[string]struct{}{
	"general": {}, "blue-equity": {}, "condom-tier": {}, "language": {},
	"help-or-harm": {}, "groups": {}, "active-infection": {},
	"notification-feel": {}, "verification": {}, "testing-window": {},
	"detectable-hiv": {}, "missing": {},
}

// ValidFeedbackTopic reports whether t is empty or one of the fixed topic codes.
func ValidFeedbackTopic(t string) bool {
	if t == "" {
		return true
	}
	_, ok := feedbackTopics[t]
	return ok
}

// FeedbackBodyMaxRunes caps the optional note, the one free-text field the store
// holds, so intake cannot be used to dump unbounded content. A longer body is a 400.
const FeedbackBodyMaxRunes = 2000

// FeedbackRequest is the body of POST /feedback: a fixed reason code, an optional
// fixed topic code (which open question a "question" response addresses), and an
// optional note. The endpoint is public + rate-limited; the record names no
// reporter.
type FeedbackRequest struct {
	Reason string `json:"reason"`
	Topic  string `json:"topic,omitempty"`
	Body   string `json:"body"`
}

// AdminFeedback is one open report in the admin queue (GET /admin/feedback): its row
// id (the resolve target), category, the optional topic code, the optional note the
// person typed, and when it came in. Operator-readable by design; never a reporter
// identity.
type AdminFeedback struct {
	ID        int64  `json:"id"`
	Reason    string `json:"reason"`
	Topic     string `json:"topic,omitempty"`
	Body      string `json:"body"`
	CreatedAt int64  `json:"createdAt"`
}

// AdminFeedbackResponse is GET /admin/feedback's body.
type AdminFeedbackResponse struct {
	Feedback []AdminFeedback `json:"feedback"`
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
	Accounts        int64 `json:"accounts"`        // distinct account-sync blobs
	Aliases         int64 `json:"aliases"`         // distinct alias (live-link) ciphertext rows
	Knocks          int64 `json:"knocks"`          // live knock rows (auto-expiring)
	SendQueueDepth  int64 `json:"sendQueueDepth"`  // wake jobs awaiting drain
	DBSizeBytes     int64 `json:"dbSizeBytes"`     // logical database size
	PendingReports  int   `json:"pendingReports"`  // names awaiting review in the queue
	PendingFeedback int   `json:"pendingFeedback"` // "Something wrong?" reports awaiting review
}

// AdminErrorCount is one subsystem's internal-error total in the health snapshot
// (GET /admin/health): a fixed subsystem name and a running count, never an error
// message or a value.
type AdminErrorCount struct {
	Type  string `json:"type"`
	Count int64  `json:"count"`
}

// AdminHealthResponse is GET /admin/health's body (doc 20): the aggregate,
// identifier-free operational-health signals the operator console surfaces, so a
// backing-up send queue, a stalled background loop, or a rise in internal errors is
// visible at a glance instead of only by reading /metrics on the box. errors is the
// internal-error count per subsystem; sendQueueDepth and sendQueueOldestAgeSeconds
// show a draining-vs-stuck queue; janitorAgeSeconds is how long since the background
// loop last ticked (-1 if it has never run); inflight is the current concurrency
// against its configured cap. Every field is a count, an age, or a system size, never
// a per-account or per-id figure, so it stays within the blind-store boundary (doc
// 12). A read, so it is not itself audited.
type AdminHealthResponse struct {
	Errors                    []AdminErrorCount `json:"errors"`
	ErrorsToday               []AdminErrorCount `json:"errorsToday"`
	SendQueueDepth            int64             `json:"sendQueueDepth"`
	SendQueueOldestAgeSeconds int64             `json:"sendQueueOldestAgeSeconds"`
	JanitorAgeSeconds         int64             `json:"janitorAgeSeconds"`
	InflightCurrent           int64             `json:"inflightCurrent"`
	InflightMax               int64             `json:"inflightMax"`
	// The box strip: which binary is running, for how long, and how much disk
	// is left under the database. System facts, never subject data.
	BuildVersion  string `json:"buildVersion,omitempty"`
	UptimeSeconds int64  `json:"uptimeSeconds"`
	DiskFreeBytes int64  `json:"diskFreeBytes"`
}

// AdminErrorDay is one UTC epoch-day of internal-error counts by fixed
// subsystem (GET /admin/errors). Counts of events, never a message or value.
type AdminErrorDay struct {
	Day     int64 `json:"day"`
	Store   int64 `json:"store"`
	Enqueue int64 `json:"enqueue"`
	Janitor int64 `json:"janitor"`
	Decode  int64 `json:"decode"`
}

// AdminErrorsResponse is GET /admin/errors' body (doc 20): the per-day error
// series over a recent window (zero-filled, oldest first) plus the lifetime
// totals per subsystem. The totals survive restarts (the metrics snapshot);
// POST /admin/errors/clear zeroes them while the daily history stays.
type AdminErrorsResponse struct {
	Days   []AdminErrorDay   `json:"days"`
	Totals []AdminErrorCount `json:"totals"`
}

// AdminPerfResponse is GET /admin/perf's body (doc 20): requests per day over
// a recent window and the request-latency histogram aggregated across endpoint
// templates (per-bucket counts; underMs 0 is the trailing slower-than-the-last-
// bound overflow, the same convention as the review-latency series). Aggregate
// only, never a per-request or per-id figure.
type AdminPerfResponse struct {
	RequestsPerDay []DayCount      `json:"requestsPerDay"`
	Latency        []LatencyBucket `json:"latency"`
}

// AdminLogEntry is one recent service log line (GET /admin/logs): the instant, the
// level, the fixed message, and the record's attributes rendered "k=v". Log lines
// are bounded by doc 12 §4 (a static message, a count, an err value, a config
// string at startup; never an id, token, IP, or user-typed text), so serving them
// stays within the blind-store boundary.
type AdminLogEntry struct {
	At    int64  `json:"at"` // unix milliseconds
	Level string `json:"level"`
	Msg   string `json:"msg"`
	Attrs string `json:"attrs,omitempty"`
}

// AdminLogsResponse is GET /admin/logs' body (doc 20): the most recent lines from
// the in-process log buffer, newest first. The buffer starts empty on every boot
// (the box's journal stays the deep archive). A read, so it is not itself audited.
type AdminLogsResponse struct {
	Entries []AdminLogEntry `json:"entries"`
}

// DayCount is one daily bucket of a trend series (GET /admin/trends): an epoch-day
// (days since the Unix epoch, UTC) and how many opaque rows fall in it. The day is a
// bucket, never a per-row timestamp, and the count names no subject.
type DayCount struct {
	Day   int64 `json:"day"`
	Count int   `json:"count"`
}

// LatencyBucket is one bar of the review-latency histogram (GET /admin/trends): how
// many still-open reports have waited less than UnderMs. UnderMs is 0 for the
// trailing "older" overflow bucket. A bucketed count of opaque rows, never a
// per-report wait keyed to a name or id.
type LatencyBucket struct {
	UnderMs int64 `json:"underMs"`
	Count   int   `json:"count"`
}

// AdminTrendsResponse is GET /admin/trends' body (doc 20 metrics panel): aggregate,
// identifier-free time series for the trend charts. reportsPerDay is the count of
// reports filed on each recent day; signupsPerDay is the count of accounts created on
// each recent day (a purely aggregate daily tally, never a per-account creation time);
// reviewLatency buckets how long the still-open reports have waited. All read only
// per-day counts or a latency bucket, never a per-account or per-id figure and never a
// distribution that could fingerprint one account, so it stays within the blind-store
// boundary (doc 12). A read, so it is not itself audited. Kept SEPARATE from
// AdminMetricsResponse so the always-loaded totals stay one cheap query and this
// heavier aggregation is fetched only when the trends view mounts.
type AdminTrendsResponse struct {
	ReportsPerDay []DayCount      `json:"reportsPerDay"`
	SignupsPerDay []DayCount      `json:"signupsPerDay"`
	ReviewLatency []LatencyBucket `json:"reviewLatency"`
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
