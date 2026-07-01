package store

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// payloadGetters is the EXACT allowlist of functions permitted to SELECT the
// ciphertext column. These are the blind payload reads (the alias/account/inbox
// getters and the shared fixed-payload helper) and the alias/account write paths,
// which must read the row to gate on the write token. Every other SELECT in the
// package must project only length(ciphertext), never the ciphertext itself, so
// no new read path can quietly start returning stored content. A new
// `SELECT ... ciphertext` outside this set fails the test on purpose: extend the
// allowlist only when the new reader is a deliberate payload getter.
var payloadGetters = map[string]bool{
	"getFixed":       true, // shared inbox payload read
	"GetAlias":       true, // public card payload read
	"GetAccount":     true, // account sync blob read
	"DueRepublishes": true, // deferred overwrite carries the ciphertext to re-apply

	"GetRecoveryEnvelope": true, // password-recovery envelope read (doc 32)
}

// ciphertextSelectRe matches a SELECT whose projection names the ciphertext
// column, excluding length(ciphertext). It is intentionally loose on the SELECT
// keyword and tight on "ciphertext not preceded by length(".
var ciphertextSelectRe = regexp.MustCompile(`(?is)\bSELECT\b.*?\bciphertext\b`)

// TestCiphertextProjectionAllowlist asserts that the only functions in this
// package whose body contains a SELECT projecting the ciphertext column are the
// known payload getters. It parses the package's own .go source, finds string
// literals that look like a ciphertext SELECT (ignoring length(ciphertext) and
// comments), and checks the enclosing function is on the allowlist.
func TestCiphertextProjectionAllowlist(t *testing.T) {
	dir := "."
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}

	fset := token.NewFileSet()
	offenders := map[string]bool{}

	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		path := filepath.Join(dir, name)
		src, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		// Comments are dropped by default (no ParseComments), so a SELECT mentioned
		// in a doc comment never reaches the inspection below.
		file, err := parser.ParseFile(fset, path, src, 0)
		if err != nil {
			t.Fatalf("parse %s: %v", path, err)
		}

		ast.Inspect(file, func(n ast.Node) bool {
			fn, ok := n.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				return true
			}
			fnName := fn.Name.Name
			ast.Inspect(fn.Body, func(inner ast.Node) bool {
				lit, ok := inner.(*ast.BasicLit)
				if !ok || lit.Kind != token.STRING {
					return true
				}
				sql := lit.Value
				if !mentionsCiphertextSelect(sql) {
					return true
				}
				if !payloadGetters[fnName] {
					offenders[fnName] = true
				}
				return true
			})
			return true
		})
	}

	if len(offenders) > 0 {
		var names []string
		for n := range offenders {
			names = append(names, n)
		}
		sort.Strings(names)
		t.Fatalf("functions SELECT ciphertext outside the payload-getter allowlist: %v\n"+
			"a SELECT that projects the ciphertext column may only live in a deliberate "+
			"payload getter; everything else must use length(ciphertext)", names)
	}

	// Guard the guard: the allowlisted getters must actually still project the
	// ciphertext column, so a refactor that renames or drops one is noticed rather
	// than silently shrinking the set this test protects.
	found := scanGettersThatSelectCiphertext(t, fset)
	for name := range payloadGetters {
		if !found[name] {
			t.Errorf("allowlisted payload getter %q no longer SELECTs ciphertext; "+
				"update payloadGetters", name)
		}
	}
}

// mentionsCiphertextSelect reports whether a SQL string literal contains a SELECT
// that projects the ciphertext column, ignoring length(ciphertext).
func mentionsCiphertextSelect(sql string) bool {
	if !ciphertextSelectRe.MatchString(sql) {
		return false
	}
	// Strip every length(ciphertext) occurrence, then re-check: if a bare
	// ciphertext SELECT remains, it is a real projection.
	stripped := regexp.MustCompile(`(?i)length\(\s*ciphertext\s*\)`).ReplaceAllString(sql, "")
	return ciphertextSelectRe.MatchString(stripped)
}

// scanGettersThatSelectCiphertext returns the set of functions in this package
// whose body contains a ciphertext SELECT.
func scanGettersThatSelectCiphertext(t *testing.T, fset *token.FileSet) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	entries, err := os.ReadDir(".")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		src, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		file, err := parser.ParseFile(fset, name, src, 0)
		if err != nil {
			t.Fatal(err)
		}
		ast.Inspect(file, func(n ast.Node) bool {
			fn, ok := n.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				return true
			}
			ast.Inspect(fn.Body, func(inner ast.Node) bool {
				lit, ok := inner.(*ast.BasicLit)
				if ok && lit.Kind == token.STRING && mentionsCiphertextSelect(lit.Value) {
					out[fn.Name.Name] = true
				}
				return true
			})
			return true
		})
	}
	return out
}
