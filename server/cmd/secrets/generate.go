package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// Key names this tool can generate. Kept here so the generate/rotate commands and
// the docs name the exact env keys the server reads.
const (
	keyDecoy        = "STI_DECOY_SECRET"
	keyVapidPublic  = "STI_VAPID_PUBLIC_KEY"
	keyVapidPrivate = "STI_VAPID_PRIVATE_KEY"
	keyAdminToken   = "STI_ADMIN_TOKEN"
	keyAdminEnabled = "STI_ADMIN_ENABLED"
)

// cmdPull adopts the box's current env into the store: every key on the box that
// the store does not already define is copied in (a locally staged edit wins), so a
// fresh or partial store is filled from the running box in one step instead of by
// hand. A later `diff`/`sync` then shows only the keys you actually changed, instead
// of proposing to wipe everything the box already has.
func cmdPull(cfg Config) error {
	remote, err := cfg.remoteEnv()
	if err != nil {
		return err
	}
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	merged, added := addMissing(plain, remote)
	if len(added) == 0 {
		fmt.Println("secrets: nothing to pull; the store already defines every key on the box.")
		return nil
	}
	if err := cfg.save(merged); err != nil {
		return err
	}
	fmt.Printf("secrets: pulled %d key(s) from the box: %s\n", len(added), strings.Join(added, ", "))
	fmt.Println("secrets: review with 'diff', then 'sync'.")
	return nil
}

// newDecoyHex returns a fresh 32-byte decoy secret as lowercase hex (the format the
// server's STI_DECOY_SECRET expects: hex, >= 32 bytes).
func newDecoyHex() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// cmdGenDecoy generates a fresh decoy secret (the existence-uniformity key, doc 10)
// and sets it in the store. The value is NOT printed: rotating it is a security
// action and the bytes must not land in terminal scrollback.
func cmdGenDecoy(cfg Config) error {
	value, err := newDecoyHex()
	if err != nil {
		return err
	}
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	if err := cfg.save(upsert(plain, keyDecoy, value)); err != nil {
		return err
	}
	fmt.Printf("secrets: set %s to 32 fresh random bytes. Review with 'diff', then 'sync'.\n", keyDecoy)
	return nil
}

// newAdminToken returns a fresh bearer token for the admin surface: 32 random bytes
// as base64url (43 chars), comfortably over the server's 32-char floor.
func newAdminToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// cmdGenAdmin enables the operator surface (doc 20): it generates a strong admin
// token and sets BOTH STI_ADMIN_TOKEN and STI_ADMIN_ENABLED=true, because the server
// refuses to boot with the flag on but no adequate token, and ignores a token with
// the flag off. The token is not printed (it is a bearer secret); retrieve it with
// `show STI_ADMIN_TOKEN` when you need it to call the admin API. Re-running rotates
// the token in place.
func cmdGenAdmin(cfg Config) error {
	tok, err := newAdminToken()
	if err != nil {
		return err
	}
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	plain = upsert(plain, keyAdminToken, tok)
	plain = upsert(plain, keyAdminEnabled, "true")
	if err := cfg.save(plain); err != nil {
		return err
	}
	fmt.Printf("secrets: set %s (32 random bytes) and %s=true.\n", keyAdminToken, keyAdminEnabled)
	fmt.Printf("secrets: retrieve the token with 'secrets show %s' when you need it.\n", keyAdminToken)
	fmt.Println("secrets: review with 'diff', then 'sync'.")
	return nil
}

// cmdGenVapid generates a fresh Web Push VAPID keypair with the same library and
// base64url format the server and browser use, and sets both keys in the store. The
// public key is printed (it is public by design, served at /vapid); the private key
// is not. Rotating invalidates existing push subscriptions, which re-subscribe on
// the client's next visit.
func cmdGenVapid(cfg Config) error {
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		return err
	}
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	plain = upsert(plain, keyVapidPublic, pub)
	plain = upsert(plain, keyVapidPrivate, priv)
	if err := cfg.save(plain); err != nil {
		return err
	}
	fmt.Printf("secrets: set %s and %s.\n", keyVapidPublic, keyVapidPrivate)
	fmt.Printf("  public key (safe to share): %s\n", pub)
	fmt.Println("secrets: review with 'diff', then 'sync'. Existing push subscriptions re-subscribe on next visit.")
	return nil
}
