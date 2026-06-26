package server

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	webpush "github.com/SherClockHolmes/webpush-go"

	"sti.care/api/internal/store"
)

// A valid Web Push subscription keypair (p256dh + auth) so the library actually
// encrypts the payload rather than erroring on malformed keys.
func testSubKeys(t *testing.T) (p256dh, auth string) {
	t.Helper()
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	authBytes := make([]byte, 16)
	if _, err := rand.Read(authBytes); err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()),
		base64.RawURLEncoding.EncodeToString(authBytes)
}

// The wake is shaped correctly: a POST carrying a VAPID Authorization header, an
// encrypted (non-empty, aes128gcm) body, and a TTL, and it carries no plaintext
// content (the body is ciphertext of an empty payload).
func TestWebPushSenderShapesRequest(t *testing.T) {
	var got struct {
		method, auth, encoding, ttl string
		bodyLen                     int
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, 4096)
		n, _ := r.Body.Read(buf)
		got.method = r.Method
		got.auth = r.Header.Get("Authorization")
		got.encoding = r.Header.Get("Content-Encoding")
		got.ttl = r.Header.Get("TTL")
		got.bodyLen = n
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	p256dh, auth := testSubKeys(t)
	sender := NewWebPushSender(pub, priv, "mailto:ops@sti.care")

	err = sender.Send(context.Background(), store.PushTarget{
		Endpoint: srv.URL,
		P256dh:   p256dh,
		Auth:     auth,
	})
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if got.method != "POST" {
		t.Errorf("method = %q, want POST", got.method)
	}
	if !strings.HasPrefix(got.auth, "vapid") {
		t.Errorf("Authorization = %q, want a vapid token", got.auth)
	}
	if got.encoding != "aes128gcm" {
		t.Errorf("Content-Encoding = %q, want aes128gcm", got.encoding)
	}
	// A long store-and-forward TTL (doc 22 "Slice 5 reconsidered"): the push service
	// holds an undelivered contentless wake and delivers it on the recipient's next
	// reconnect, so an offline user is not silently skipped.
	if want := strconv.Itoa(notifyWakeTTLSeconds); got.ttl != want {
		t.Errorf("TTL = %q, want %q (long store-and-forward)", got.ttl, want)
	}
	if got.bodyLen == 0 {
		t.Errorf("body was empty; expected an encrypted record")
	}
}

func TestWebPushSenderErrorsOnNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusGone) // 410: subscription expired
	}))
	defer srv.Close()

	priv, pub, _ := webpush.GenerateVAPIDKeys()
	p256dh, auth := testSubKeys(t)
	sender := NewWebPushSender(pub, priv, "mailto:ops@sti.care")

	err := sender.Send(context.Background(), store.PushTarget{
		Endpoint: srv.URL,
		P256dh:   p256dh,
		Auth:     auth,
	})
	if err == nil {
		t.Fatal("expected an error on a 410 response")
	}
}
