package main

import (
	"crypto/rand"
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
