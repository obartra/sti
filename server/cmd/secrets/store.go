package main

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// The decrypted store is a plain env file: a header comment then KEY=value lines,
// one per line. These helpers operate on that text directly so the parsing,
// upsert, removal, diff, and validation logic is pure and unit-tested, with no
// crypto or network in the way.

const storeHeader = "# stiapi.env, managed by cmd/secrets. KEY=value per line."

var keyRe = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func validKey(k string) bool { return keyRe.MatchString(k) }

func splitLines(text string) []string {
	text = strings.TrimRight(text, "\n")
	if text == "" {
		return nil
	}
	return strings.Split(text, "\n")
}

// keyOf returns the key a line defines, or "" if the line is blank, a comment, or
// not a KEY=value assignment.
func keyOf(line string) string {
	if strings.HasPrefix(strings.TrimSpace(line), "#") {
		return ""
	}
	eq := strings.IndexByte(line, '=')
	if eq <= 0 {
		return ""
	}
	k := strings.TrimSpace(line[:eq])
	if !validKey(k) {
		return ""
	}
	return k
}

// parseEnv reads the KEY=value pairs into a map (last assignment wins).
func parseEnv(text string) map[string]string {
	m := map[string]string{}
	for _, line := range splitLines(text) {
		if k := keyOf(line); k != "" {
			m[k] = line[strings.IndexByte(line, '=')+1:]
		}
	}
	return m
}

// keysOf returns the key names in file order.
func keysOf(text string) []string {
	var ks []string
	seen := map[string]bool{}
	for _, line := range splitLines(text) {
		if k := keyOf(line); k != "" && !seen[k] {
			seen[k] = true
			ks = append(ks, k)
		}
	}
	return ks
}

// upsert sets key=value, replacing the first matching assignment in place or
// appending a new line, always leaving exactly one trailing newline.
func upsert(text, key, value string) string {
	lines := splitLines(text)
	done := false
	for i, line := range lines {
		if !done && keyOf(line) == key {
			lines[i] = key + "=" + value
			done = true
		}
	}
	if !done {
		lines = append(lines, key+"="+value)
	}
	return strings.Join(lines, "\n") + "\n"
}

// removeKey drops the assignment(s) for key, reporting whether anything matched.
func removeKey(text, key string) (string, bool) {
	lines := splitLines(text)
	out := make([]string, 0, len(lines))
	removed := false
	for _, line := range lines {
		if keyOf(line) == key {
			removed = true
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n") + "\n", removed
}

// missingRequired returns the required keys that are absent or empty.
func missingRequired(env map[string]string, required []string) []string {
	var missing []string
	for _, k := range required {
		if strings.TrimSpace(env[k]) == "" {
			missing = append(missing, k)
		}
	}
	return missing
}

// EnvDiff is the key-level difference between the local store and what is on the
// box: which keys would be added, which removed, which changed in value. Values
// are never carried here, so printing a diff never prints a secret.
type EnvDiff struct {
	Added   []string
	Removed []string
	Changed []string
}

func (d EnvDiff) empty() bool {
	return len(d.Added)+len(d.Removed)+len(d.Changed) == 0
}

func diffEnv(local, remote map[string]string) EnvDiff {
	var d EnvDiff
	for k, lv := range local {
		rv, ok := remote[k]
		switch {
		case !ok:
			d.Added = append(d.Added, k)
		case rv != lv:
			d.Changed = append(d.Changed, k)
		}
	}
	for k := range remote {
		if _, ok := local[k]; !ok {
			d.Removed = append(d.Removed, k)
		}
	}
	sort.Strings(d.Added)
	sort.Strings(d.Removed)
	sort.Strings(d.Changed)
	return d
}

func splitOwner(s string) (owner, group string) {
	if i := strings.IndexByte(s, ':'); i >= 0 {
		return s[:i], s[i+1:]
	}
	return s, s
}

// remoteInstallCmd builds the command run on the box over SSH: write stdin to the
// env file with the right owner and mode, then restart the service and confirm it
// came back. Built as one string (and unit-pinned) so a config change can't
// silently produce a malformed command.
func remoteInstallCmd(cfg Config) string {
	owner, group := splitOwner(cfg.RemoteOwner)
	p := ""
	if cfg.Sudo != "" {
		p = cfg.Sudo + " "
	}
	return fmt.Sprintf(
		"%sinstall -m '%s' -o '%s' -g '%s' /dev/stdin '%s' && %ssystemctl restart '%s' && %ssystemctl is-active '%s'",
		p, cfg.RemoteMode, owner, group, cfg.RemotePath, p, cfg.Service, p, cfg.Service,
	)
}

// remoteReadCmd reads the current env file off the box (for diff). Missing file is
// not an error to the caller; it means nothing is deployed yet.
func remoteReadCmd(cfg Config) string {
	p := ""
	if cfg.Sudo != "" {
		p = cfg.Sudo + " "
	}
	return fmt.Sprintf("%scat '%s' 2>/dev/null || true", p, cfg.RemotePath)
}
