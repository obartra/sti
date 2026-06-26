package main

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"filippo.io/age"
	"filippo.io/age/agessh"
	"golang.org/x/crypto/ssh"
	"golang.org/x/term"
)

// The store is age-encrypted to a set of SSH public keys (recipients.txt) and
// decrypted with the matching SSH private key. Using the age library directly,
// rather than shelling out to an `age` binary, keeps the tool self-contained.

// recipientsFrom parses authorized_keys-style lines into age recipients.
func recipientsFrom(text string) ([]age.Recipient, error) {
	var rs []age.Recipient
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		r, err := agessh.ParseRecipient(line)
		if err != nil {
			return nil, fmt.Errorf("bad recipient %q: %w", firstFields(line, 2), err)
		}
		rs = append(rs, r)
	}
	if len(rs) == 0 {
		return nil, errors.New("no recipients (run init, or recipients add)")
	}
	return rs, nil
}

// validRecipient reports whether a single line is a usable SSH public key.
func validRecipient(line string) error {
	_, err := agessh.ParseRecipient(strings.TrimSpace(line))
	return err
}

func encrypt(plain string, recipients []age.Recipient) ([]byte, error) {
	var buf bytes.Buffer
	w, err := age.Encrypt(&buf, recipients...)
	if err != nil {
		return nil, err
	}
	if _, err := io.WriteString(w, plain); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func decrypt(cipher []byte, identityPath string) (string, error) {
	id, err := loadIdentity(identityPath)
	if err != nil {
		return "", err
	}
	r, err := age.Decrypt(bytes.NewReader(cipher), id)
	if err != nil {
		return "", fmt.Errorf("decrypt (is %s a recipient?): %w", identityPath, err)
	}
	var out bytes.Buffer
	if _, err := io.Copy(&out, r); err != nil {
		return "", err
	}
	return out.String(), nil
}

// loadIdentity loads an SSH private key as an age identity, prompting for a
// passphrase if the key is encrypted (the same path the age CLI takes).
func loadIdentity(path string) (age.Identity, error) {
	pem, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read identity %s: %w", path, err)
	}
	id, err := agessh.ParseIdentity(pem)
	if err == nil {
		return id, nil
	}
	var passErr *ssh.PassphraseMissingError
	if !errors.As(err, &passErr) {
		return nil, fmt.Errorf("parse identity %s: %w", path, err)
	}
	pub := passErr.PublicKey
	if pub == nil {
		pub, err = readPubKey(path + ".pub")
		if err != nil {
			return nil, err
		}
	}
	enc, err := agessh.NewEncryptedSSHIdentity(pub, pem, func() ([]byte, error) {
		fmt.Fprintf(os.Stderr, "Enter passphrase for %s: ", path)
		defer fmt.Fprintln(os.Stderr)
		return term.ReadPassword(int(os.Stdin.Fd()))
	})
	if err != nil {
		return nil, err
	}
	return enc, nil
}

func readPubKey(path string) (ssh.PublicKey, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read public key %s: %w", path, err)
	}
	pub, _, _, _, err := ssh.ParseAuthorizedKey(b)
	if err != nil {
		return nil, fmt.Errorf("parse public key %s: %w", path, err)
	}
	return pub, nil
}

// firstFields returns the first n space-separated fields of s, for error messages
// that name a key without dumping the whole line.
func firstFields(s string, n int) string {
	f := strings.Fields(s)
	if len(f) > n {
		f = f[:n]
	}
	return strings.Join(f, " ")
}
