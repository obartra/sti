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

// --- Fixed sizes (the existence-hiding knobs) -------------------------------

const (
	// AliasPayloadSize is the single fixed wire size of every GET /a response.
	// Real ciphertext is padded to it and decoys are generated at it, so response
	// length never distinguishes a real alias from a decoy or from another user's.
	AliasPayloadSize = 4096

	// AccountBlobMaxSize caps the device-sync blob (not existence-sensitive; the
	// account id is derived from the owner's own key).
	AccountBlobMaxSize = 1 << 20 // 1 MiB
)

// --- Endpoints --------------------------------------------------------------

const (
	PathAliasPrefix   = "/a/"            // GET: resolve an alias (hot read)
	PathAccountPrefix = "/acct/"         // GET/PUT: device-sync blob
	PathNotify        = "/notify"        // POST: enqueue a contentless wake
	PathPushRegister  = "/push/register" // POST: register a Web Push endpoint
	PathKnockPrefix   = "/knock/"        // POST: contentless knock
	PathHealth        = "/healthz"       // GET: liveness
)

// --- JSON bodies (only the non-byte endpoints) ------------------------------

// NotifyRequest enqueues a contentless wake for a pairwise notify token. The
// server resolves hash(notify_token) to a routing endpoint; it never sees the
// token itself or who is notifying whom.
type NotifyRequest struct {
	TokenHash string `json:"tokenHash"`
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
type KnockRequest struct {
	RequesterHash string `json:"requesterHash"`
}

// KnockResponse is the ONLY response POST /knock ever returns, byte-identical for
// real, fake, guessed, and over-limit ids, so a knock reveals nothing about
// whether the alias exists.
type KnockResponse struct {
	Status string `json:"status"`
}

// KnockReviewResponse is what GET /knock/{id} returns to the alias OWNER (who
// proves ownership with the write token): the count of current knocks on that
// alias. Contentless — it names no requester and carries no timing per knock; it
// is the owner-pull "quiet indicator" (doc 02), never pushed.
type KnockReviewResponse struct {
	Count int `json:"count"`
}

// HeaderWriteToken authorizes a PUT to an alias. The owner holds it; viewers get
// only the read id in the URL, so they can resolve an alias but never overwrite
// it. The server stores hash(token) on first write and requires a match after.
const HeaderWriteToken = "X-Write-Token"

// HeaderVersion carries the account-blob version on sync reads/writes.
const HeaderVersion = "X-Version"

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
	ErrBadRequest  = "bad_request"
	ErrTooLarge    = "payload_too_large"
	ErrRateLimited = "rate_limited"
	ErrInternal    = "internal"
	ErrNotFound    = "not_found" // never used on /a or /knock
	ErrUnsupported = "unsupported_media_type"
	ErrMethodNotOk = "method_not_allowed"
)
