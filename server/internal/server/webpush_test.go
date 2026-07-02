package server

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"errors"
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

// offCurvePoint is 65 bytes in uncompressed form (0x04 prefix) whose coordinates are
// not on P-256, so ecdh rejects it. This is the shape of the junk p256dh that flooded
// the janitor with "Public key is not a valid point on the curve" every tick.
func offCurvePoint() []byte {
	b := make([]byte, 65)
	b[0] = 0x04
	return b
}

func TestValidPushKeys(t *testing.T) {
	good, auth := testSubKeys(t)
	badPoint := base64.RawURLEncoding.EncodeToString(offCurvePoint())
	shortAuth := base64.RawURLEncoding.EncodeToString(make([]byte, 8))
	cases := []struct {
		name         string
		p256dh, auth string
		want         bool
	}{
		{"valid", good, auth, true},
		{"p256dh not on curve", badPoint, auth, false},
		{"p256dh not base64", "!!! not base64 !!!", auth, false},
		{"p256dh empty", "", auth, false},
		{"auth wrong length", good, shortAuth, false},
		{"auth not base64", good, "@@@@", false},
		{"auth empty", good, "", false},
	}
	for _, c := range cases {
		if got := validPushKeys(c.p256dh, c.auth); got != c.want {
			t.Errorf("%s: validPushKeys = %v, want %v", c.name, got, c.want)
		}
	}
}

// A malformed key must classify as ErrSubscriptionGone BEFORE any network call, so
// the drain prunes the target instead of retrying the crypto every janitor tick
// forever (the production "push send" flood). The endpoint is never contacted.
func TestWebPushSenderPrunesMalformedKey(t *testing.T) {
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	_, auth := testSubKeys(t)
	sender := NewWebPushSender(pub, priv, "mailto:ops@sti.care")

	got := sender.Send(context.Background(), store.PushTarget{
		Endpoint: "https://push.example.invalid/never-reached",
		P256dh:   base64.RawURLEncoding.EncodeToString(offCurvePoint()),
		Auth:     auth,
	})
	if !errors.Is(got, ErrSubscriptionGone) {
		t.Fatalf("Send with a malformed key = %v, want ErrSubscriptionGone", got)
	}
}
