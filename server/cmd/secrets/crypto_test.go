package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/ssh"
)

// writeTestKey makes a throwaway, unencrypted ed25519 SSH keypair on disk and
// returns the private-key path and its authorized_keys line.
func writeTestKey(t *testing.T, dir string) (identity, authLine string) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatal(err)
	}
	authLine = string(ssh.MarshalAuthorizedKey(sshPub))
	block, err := ssh.MarshalPrivateKey(priv, "")
	if err != nil {
		t.Fatal(err)
	}
	identity = filepath.Join(dir, "id_ed25519")
	if err := os.WriteFile(identity, pem.EncodeToMemory(block), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(identity+".pub", []byte(authLine), 0o644); err != nil {
		t.Fatal(err)
	}
	return identity, authLine
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	dir := t.TempDir()
	identity, authLine := writeTestKey(t, dir)
	rs, err := recipientsFrom(authLine)
	if err != nil {
		t.Fatal(err)
	}
	cipher, err := encrypt("A=1\nB=two words\n", rs)
	if err != nil {
		t.Fatal(err)
	}
	got, err := decrypt(cipher, identity)
	if err != nil {
		t.Fatal(err)
	}
	if got != "A=1\nB=two words\n" {
		t.Fatalf("round trip = %q", got)
	}
}

func TestConfigSaveLoad(t *testing.T) {
	dir := t.TempDir()
	identity, authLine := writeTestKey(t, dir)
	if err := os.WriteFile(filepath.Join(dir, "recipients.txt"), []byte(authLine), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg := Config{Dir: dir, Identity: identity}
	if err := cfg.save("STI_DECOY_SECRET=abc\n"); err != nil {
		t.Fatal(err)
	}
	plain, err := cfg.load()
	if err != nil {
		t.Fatal(err)
	}
	if plain != "STI_DECOY_SECRET=abc\n" {
		t.Fatalf("load = %q", plain)
	}
	// a value with spaces survives upsert -> encrypt -> decrypt
	if err := cfg.save(upsert(plain, "STI_ADMIN_TOKEN", "tok with spaces")); err != nil {
		t.Fatal(err)
	}
	plain, _ = cfg.load()
	if parseEnv(plain)["STI_ADMIN_TOKEN"] != "tok with spaces" {
		t.Fatalf("value with spaces lost: %q", plain)
	}
}

func TestDecryptWrongKeyFails(t *testing.T) {
	dir := t.TempDir()
	_, authLine := writeTestKey(t, dir)
	rs, _ := recipientsFrom(authLine)
	cipher, _ := encrypt("X=1\n", rs)

	otherID, _ := writeTestKey(t, t.TempDir())
	if _, err := decrypt(cipher, otherID); err == nil {
		t.Fatal("decrypt with a non-recipient key should fail")
	}
}
