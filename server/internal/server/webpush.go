package server

import (
	"context"
	"fmt"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"

	"sti.care/api/internal/store"
)

// WebPushSender is the concrete Sender: it delivers a contentless wake over the
// Web Push protocol (RFC 8291 payload encryption, RFC 8292 VAPID auth) via the
// webpush-go library. The body is EMPTY by design — a wake only tells the
// recipient's device to open the app and check locally; it never carries who
// notified them, why, or any status. The app's service worker turns the wake
// into a generic "open the app" prompt; all conditional rendering is client-side.
//
// NOTE (validation): this needs verification against a real browser push
// subscription + a live push service; it cannot be exercised headlessly beyond
// the request-shaping test. It stays gated by Config.NotifyEnabled, and is only
// constructed when VAPID keys are configured (see cmd/stiapi).
type WebPushSender struct {
	publicKey  string
	privateKey string
	// subject is the VAPID "sub" claim (a mailto: or https: contact); some push
	// services reject a token without it. It identifies the sender, not a user.
	subject string
	ttl     int
	client  webpush.HTTPClient
}

// NewWebPushSender builds a sender from a VAPID keypair (base64url) and a contact
// subject. ttl is the push TTL in seconds; a wake is only useful briefly.
func NewWebPushSender(publicKey, privateKey, subject string) *WebPushSender {
	return &WebPushSender{
		publicKey:  publicKey,
		privateKey: privateKey,
		subject:    subject,
		ttl:        30,
		client:     http.DefaultClient,
	}
}

// Send delivers one empty wake to a single subscription. A 404/410 means the
// subscription has expired; that surfaces as an error so the drain loop's
// retain-on-failure behavior applies (the caller may later prune dead targets).
func (w *WebPushSender) Send(ctx context.Context, t store.PushTarget) error {
	sub := &webpush.Subscription{
		Endpoint: t.Endpoint,
		Keys:     webpush.Keys{P256dh: t.P256dh, Auth: t.Auth},
	}
	resp, err := webpush.SendNotificationWithContext(ctx, []byte{}, sub, &webpush.Options{
		HTTPClient:      w.client,
		Subscriber:      w.subject,
		VAPIDPublicKey:  w.publicKey,
		VAPIDPrivateKey: w.privateKey,
		TTL:             w.ttl,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("web push: unexpected status %d", resp.StatusCode)
	}
	return nil
}
