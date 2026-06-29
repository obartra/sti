package main

import (
	"reflect"
	"testing"
)

func TestUpsert(t *testing.T) {
	if got := upsert("", "A", "1"); got != "A=1\n" {
		t.Fatalf("empty upsert = %q", got)
	}
	if got := upsert("A=1\n", "A", "2"); got != "A=2\n" {
		t.Fatalf("replace = %q", got)
	}
	if got := upsert("A=1\n", "B", "2"); got != "A=1\nB=2\n" {
		t.Fatalf("append = %q", got)
	}
	// header preserved; value may contain spaces and '='
	if got := upsert("# h\nA=1\n", "C", "x=y z"); got != "# h\nA=1\nC=x=y z\n" {
		t.Fatalf("header/spaces = %q", got)
	}
}

func TestRemoveKey(t *testing.T) {
	if got, ok := removeKey("A=1\nB=2\n", "A"); !ok || got != "B=2\n" {
		t.Fatalf("rm = %q ok=%v", got, ok)
	}
	if _, ok := removeKey("A=1\n", "Z"); ok {
		t.Fatal("rm of a missing key reported removed")
	}
}

func TestParseAndKeys(t *testing.T) {
	text := "# c\nA=1\nB=two words\n\n# x\nA=override\n"
	env := parseEnv(text)
	if env["A"] != "override" || env["B"] != "two words" {
		t.Fatalf("parse = %v", env)
	}
	if ks := keysOf(text); !reflect.DeepEqual(ks, []string{"A", "B"}) {
		t.Fatalf("keys = %v", ks)
	}
}

func TestMissingRequired(t *testing.T) {
	env := map[string]string{"A": "x", "B": "  "}
	if got := missingRequired(env, []string{"A", "B", "C"}); !reflect.DeepEqual(got, []string{"B", "C"}) {
		t.Fatalf("missing = %v", got)
	}
}

func TestDiffEnv(t *testing.T) {
	local := map[string]string{"A": "1", "B": "2", "C": "3"}
	remote := map[string]string{"A": "1", "B": "x", "D": "9"}
	d := diffEnv(local, remote)
	if !reflect.DeepEqual(d.Added, []string{"C"}) {
		t.Fatalf("added = %v", d.Added)
	}
	if !reflect.DeepEqual(d.Changed, []string{"B"}) {
		t.Fatalf("changed = %v", d.Changed)
	}
	if !reflect.DeepEqual(d.Removed, []string{"D"}) {
		t.Fatalf("removed = %v", d.Removed)
	}
	if !diffEnv(local, local).empty() {
		t.Fatal("identical maps should diff empty")
	}
}

func TestRemoteInstallCmd(t *testing.T) {
	cfg := Config{RemotePath: "/etc/stiapi.env", RemoteOwner: "root:stiapi", RemoteMode: "0640", Service: "stiapi"}
	want := "umask 077 && tee '/etc/stiapi.env.tmp' >/dev/null && chown 'root:stiapi' '/etc/stiapi.env.tmp' && chmod '0640' '/etc/stiapi.env.tmp' && mv -f '/etc/stiapi.env.tmp' '/etc/stiapi.env' && systemctl restart 'stiapi' && systemctl is-active 'stiapi'"
	if got := remoteInstallCmd(cfg); got != want {
		t.Fatalf("\n got %q\nwant %q", got, want)
	}
	cfg.Sudo = "sudo"
	want = "umask 077 && sudo tee '/etc/stiapi.env.tmp' >/dev/null && sudo chown 'root:stiapi' '/etc/stiapi.env.tmp' && sudo chmod '0640' '/etc/stiapi.env.tmp' && sudo mv -f '/etc/stiapi.env.tmp' '/etc/stiapi.env' && sudo systemctl restart 'stiapi' && sudo systemctl is-active 'stiapi'"
	if got := remoteInstallCmd(cfg); got != want {
		t.Fatalf("sudo\n got %q\nwant %q", got, want)
	}
}

func TestValidKey(t *testing.T) {
	for _, k := range []string{"A", "A_B", "_x", "STI_DECOY_SECRET"} {
		if !validKey(k) {
			t.Fatalf("should be valid: %q", k)
		}
	}
	for _, k := range []string{"", "1A", "a-b", "a b", "a=b"} {
		if validKey(k) {
			t.Fatalf("should be invalid: %q", k)
		}
	}
}

func TestRecipientMatches(t *testing.T) {
	line := "ssh-ed25519 AAAAC3xyz them@laptop"
	for _, arg := range []string{"them@laptop", "AAAAC3xyz", "ssh-ed25519 AAAAC3xyz"} {
		if !recipientMatches(line, arg) {
			t.Fatalf("should match %q", arg)
		}
	}
	if recipientMatches(line, "someone-else") {
		t.Fatal("should not match an unrelated label")
	}
	if recipientMatches("# a comment", "comment") {
		t.Fatal("should not match a comment line")
	}
}
