package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"

	"sti.care/api/internal/store"
)

// ErrSubscriptionGone marks a permanently dead Web Push subscription: the push
// service returned 404 (unknown) or 410 (gone), so the endpoint will never accept
// another wake. The drain prunes such targets rather than retaining the cover and
// retrying forever (which would also keep a dead route in every cover broadcast).
var ErrSubscriptionGone = errors.New("web push: subscription gone")

// WebPushSender is the concrete Sender: it delivers a contentless wake over the
// Web Push protocol (RFC 8291 payload encryption, RFC 8292 VAPID auth) via the
// webpush-go library. The body is EMPTY by design: a wake only tells the
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

// notifyWakeTTLSeconds is the Web Push TTL for a partner-notify wake: long
// (store-and-forward), not seconds. The wake is contentless ("open the app and
// check locally"), and a "go get tested" nudge is useful for days, not moments, so
// the push service should HOLD an undelivered wake and deliver it when the
// recipient's device next reconnects, rather than dropping it after a brief window.
// This is what reaches a user with intermittent connectivity (doc 22 "Slice 5
// reconsidered"): a short TTL silently loses the wake for exactly the people least
// able to poll for it. Holding a contentless, cover-broadcast wake leaks nothing the
// push service does not already see (the endpoint and delivery timing), so the trade
// is reach for free. Seven days bounds it; beyond that the nudge is stale anyway.
const notifyWakeTTLSeconds = 7 * 24 * 60 * 60

// NewWebPushSender builds a sender from a VAPID keypair (base64url) and a contact
// subject. The TTL is a long store-and-forward window (notifyWakeTTLSeconds), so a
// wake survives the recipient being offline and lands on their next reconnect.
func NewWebPushSender(publicKey, privateKey, subject string) *WebPushSender {
	return &WebPushSender{
		publicKey:  publicKey,
		privateKey: privateKey,
		subject:    subject,
		ttl:        notifyWakeTTLSeconds,
		client:     http.DefaultClient,
	}
}

// Send delivers one empty wake to a single subscription. A 404/410 means the
// subscription is permanently gone; that surfaces as ErrSubscriptionGone so the
// drain prunes the dead target instead of retrying it forever. Any other non-2xx
// is a plain error, which the drain retains and retries.
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
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return fmt.Errorf("%w (status %d)", ErrSubscriptionGone, resp.StatusCode)
	}
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("web push: unexpected status %d", resp.StatusCode)
	}
	return nil
}
