// Package vanityname holds the name rules for the Findable directory (doc 17):
// normalization, the legal charset/length, and the two unclaimable sets
// (reserved + blocklist). These are pure, deterministic checks with no I/O, so
// the registration endpoint and a periodic re-scan share one definition of
// "allowed" and a name can never be accepted one place and swept another.
//
// Findable is launched: the server wires these checks into the live registration,
// resolve, and report paths (GET/PUT/DELETE /u/{name} plus POST /u/{name}/report).
package vanityname

import (
	_ "embed"
	"errors"
	"regexp"
	"strings"
)

// The legal form after normalization: lowercase ASCII letters, digits, and
// underscore, 3 to 30 characters. No Unicode (doc 17): a name is exactly the
// bytes it looks like, which removes homoglyph/confusable attacks at the charset
// level. The resolve path normalizes again and re-checks defensively.
var formatRE = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)

// Why a name was rejected. Returned by Check so the caller can surface a clear
// error at registration and so the re-scan can attribute an auto-takedown.
var (
	ErrFormat   = errors.New("vanityname: not lowercase [a-z0-9_]{3,30}")
	ErrReserved = errors.New("vanityname: reserved (operational/official term)")
	ErrBlocked  = errors.New("vanityname: blocklisted (abuse/impersonation)")
)

// Normalize maps raw input to its canonical form: trimmed and lowercased. It does
// NOT strip illegal characters; ValidFormat rejects anything left over, so a name
// is never silently rewritten into a different one.
func Normalize(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

// ValidFormat reports whether an already-normalized name matches the legal
// charset and length. Callers pass the output of Normalize.
func ValidFormat(name string) bool {
	return formatRE.MatchString(name)
}

// Reserved operational / official-impersonation terms (doc 17 §63). A starter
// list, versioned here and grown by report-and-takedown; not exhaustive. Holding
// these unclaimable stops an account masquerading as the service or its staff.
var reservedList = []string{
	"admin", "administrator", "root", "system", "sys", "official", "staff",
	"team", "mod", "moderator", "support", "help", "helpdesk", "contact",
	"info", "abuse", "security", "legal", "privacy", "billing", "payments",
	"api", "app", "www", "mail", "email", "noreply", "no_reply", "sti",
	"sticare", "care", "health", "clinic", "verify", "verified", "test",
	"null", "undefined", "demo",
}

var reserved = toSet(reservedList)

// The abuse/impersonation blocklist (doc 17 §63): slurs and harassment terms,
// curated by the operator (and counsel) and grown reactively, kept in a data file
// (no .go edit needed) and deliberately out of the design doc. NOTE: the file is
// go:embed'd into the binary below, so a change to it only takes effect after a
// rebuild + redeploy; for an already-registered name that needs to come down
// immediately, the operator uses the runtime admin takedown endpoint (doc 20)
// instead. Authority look-alikes (`*_official`, `the_real_*`) are NOT auto-blocked
// here; those are handled reactively. The committed file may be empty until curated.
//
//go:embed blocklist.txt
var blocklistData string

var blocklist = parseTerms(blocklistData)

// Reserved reports whether a normalized name is in the reserved set.
func Reserved(name string) bool {
	_, ok := reserved[name]
	return ok
}

// Blocked reports whether a normalized name is in the blocklist.
func Blocked(name string) bool {
	_, ok := blocklist[name]
	return ok
}

// Check normalizes raw input and returns the canonical name plus the first rule
// it violates (nil err = allowed). The order is format, then reserved, then
// blocked, so the error is the most fundamental reason.
func Check(raw string) (name string, err error) {
	name = Normalize(raw)
	switch {
	case !ValidFormat(name):
		return name, ErrFormat
	case Reserved(name):
		return name, ErrReserved
	case Blocked(name):
		return name, ErrBlocked
	default:
		return name, nil
	}
}

// parseTerms reads a newline-separated term list: each line is normalized, blank
// lines and `#` comments are skipped. Defensive normalization means a file edited
// by hand can't smuggle in an uppercase or padded term that would never match.
func parseTerms(data string) map[string]struct{} {
	set := make(map[string]struct{})
	for _, raw := range strings.Split(data, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		set[Normalize(line)] = struct{}{}
	}
	return set
}

func toSet(items []string) map[string]struct{} {
	set := make(map[string]struct{}, len(items))
	for _, it := range items {
		set[it] = struct{}{}
	}
	return set
}
