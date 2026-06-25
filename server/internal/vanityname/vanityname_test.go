package vanityname

import (
	"errors"
	"strings"
	"testing"
)

func TestNormalizeTrimsAndLowercases(t *testing.T) {
	if got := Normalize("  RoBiN  "); got != "robin" {
		t.Fatalf("Normalize = %q, want robin", got)
	}
}

func TestValidFormat(t *testing.T) {
	cases := []struct {
		name string
		ok   bool
	}{
		{"abc", true},
		{"rob_in", true},
		{"a1_b2", true},
		{strings.Repeat("a", 3), true},
		{strings.Repeat("a", 30), true},
		{"ab", false},                    // too short
		{strings.Repeat("a", 31), false}, // too long
		{"", false},                      // empty
		{"rob-in", false},                // hyphen not allowed
		{"rob in", false},                // space not allowed
		{"Robin", false},                 // uppercase (caller must Normalize first)
		{"café", false},                  // non-ASCII (é)
		{"robоn", false},                 // Cyrillic 'о' homoglyph rejected
	}
	for _, c := range cases {
		if got := ValidFormat(c.name); got != c.ok {
			t.Errorf("ValidFormat(%q) = %v, want %v", c.name, got, c.ok)
		}
	}
}

func TestReserved(t *testing.T) {
	for _, r := range []string{"admin", "sti", "support", "undefined"} {
		if !Reserved(r) {
			t.Errorf("Reserved(%q) = false, want true", r)
		}
	}
	if Reserved("robin") {
		t.Error("Reserved(robin) = true, want false")
	}
}

func TestParseTermsSkipsCommentsBlanksAndNormalizes(t *testing.T) {
	set := parseTerms("# a comment\n\n  Foo \nbar\n# another\nBAZ")
	want := []string{"foo", "bar", "baz"}
	if len(set) != len(want) {
		t.Fatalf("parsed %d terms, want %d (%v)", len(set), len(want), set)
	}
	for _, w := range want {
		if _, ok := set[w]; !ok {
			t.Errorf("missing %q in parsed set", w)
		}
	}
}

func TestBlockedAndCheckBlockedPath(t *testing.T) {
	// A clearly-benign name is never blocked (the committed list holds only
	// abuse/slur terms).
	if Blocked("robin_2026") {
		t.Error("Blocked(robin_2026) = true; benign name should pass")
	}
	// Seed the package set to exercise the blocked path end to end.
	orig := blocklist
	blocklist = parseTerms("badword")
	defer func() { blocklist = orig }()

	if !Blocked("badword") {
		t.Fatal("Blocked(badword) = false after seeding")
	}
	if _, err := Check("BadWord"); !errors.Is(err, ErrBlocked) {
		t.Fatalf("Check(BadWord) err = %v, want ErrBlocked", err)
	}
}

// The committed blocklist (seeded from LDNOOBW) MUST NOT block identity terms or
// core sexual-health vocabulary: blocking those would push exactly this app's
// audience out of the namespace. A regression here (e.g. a re-seed from a worse
// list) is a real harm, so it is pinned rather than left to manual review.
func TestCommittedBlocklistAllowsIdentityAndHealthTerms(t *testing.T) {
	mustAllow := []string{
		// Identity.
		"gay", "lesbian", "queer", "trans", "bisexual", "nonbinary", "lgbt",
		// Core health vocabulary.
		"prep", "hiv", "condom", "condoms", "testing", "status", "positive",
		"negative", "prophylaxis", "sexualhealth",
	}
	for _, name := range mustAllow {
		if Blocked(name) {
			t.Errorf("Blocked(%q) = true; this term must stay registerable", name)
		}
	}
}

func TestCheck(t *testing.T) {
	cases := []struct {
		raw      string
		wantName string
		wantErr  error
	}{
		{"  Robin  ", "robin", nil},
		{"a1_b2", "a1_b2", nil},
		{"ab", "ab", ErrFormat},
		{"rob-in", "rob-in", ErrFormat},
		{"ADMIN", "admin", ErrReserved}, // normalized, then reserved
		{"Sti", "sti", ErrReserved},
	}
	for _, c := range cases {
		name, err := Check(c.raw)
		if name != c.wantName {
			t.Errorf("Check(%q) name = %q, want %q", c.raw, name, c.wantName)
		}
		if !errors.Is(err, c.wantErr) {
			t.Errorf("Check(%q) err = %v, want %v", c.raw, err, c.wantErr)
		}
	}
}
