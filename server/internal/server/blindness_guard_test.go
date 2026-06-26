package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// healthVocabulary is vocabulary that would only appear if some layer were
// interpreting a user's health data: a diagnosis, a test result, an infection
// status, a clearance or risk label. The server and store are BLIND: they move
// opaque ciphertext and opaque routing tokens and never reason about what a card
// says. None of these words should appear anywhere in the server or store source
// (code OR comments), so their presence is a structural signal that health logic
// has leaked into a layer that must stay content-unaware.
//
// Deliberately omits ambiguous operational words that legitimately appear (route,
// status_class, etc.); every term here is unambiguously about health content.
var healthVocabulary = []string{
	"diagnosis",
	"clearance",
	"infected",
	"seropositive",
	"chlamydia",
	"gonorrhea",
	"herpes",
	"syphilis",
	"hiv_status",
	"test_result",
	"health_status",
	"risk_level",
	"protection_label",
}

// TestServerAndStoreRunNoHealthLogic asserts the blind layers carry no
// health-interpretation vocabulary. A grep-style structural guard: the server runs
// no health logic, so the words for it never appear.
func TestServerAndStoreRunNoHealthLogic(t *testing.T) {
	dirs := []string{".", filepath.FromSlash("../store")}
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			t.Fatalf("read %s: %v", dir, err)
		}
		for _, e := range entries {
			name := e.Name()
			if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
				continue
			}
			path := filepath.Join(dir, name)
			b, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			lower := strings.ToLower(string(b))
			for _, term := range healthVocabulary {
				if strings.Contains(lower, term) {
					t.Errorf("%s contains health-interpretation vocabulary %q; the blind layer must run no health logic", path, term)
				}
			}
		}
	}
}
