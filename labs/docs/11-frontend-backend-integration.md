# sti.care: Frontend to Backend Integration

*The "make it real." How the passport app talks to the blind store at
api.sti.care, built one tested slice at a time. Pairs with
[Build, Backend & Deployment](10-build-backend-and-deployment.md) (what the server is),
[Data & storage](/docs/data) (what lives where), and the [Decisions log](/docs/decisions) (the
locked choices this must honor).*

---

## Where we are

The passport app is live at sti.care and **talks to the backend for real**. Slices 1 through 5
below are built: onboarding mints a real key-derived session, the app derives the owner view from
the decrypted device blob (`src/ui/App.tsx` builds `createApiClient` plus `createBackendStore` and
renders `deriveOwnerView`), and public resolution, account sync, card publish, badge derivation, and
knock/notify all round-trip against the live server. Storybook still binds the fixture
implementation so the visual gate stays offline, but the running app no longer does. The backend is
deployed and blind (see [Build & Deployment](10-build-backend-and-deployment.md)): it stores opaque
ciphertext by opaque id, routes contentless pushes, rate-limits, and runs no badge logic.

This doc describes the seam between the two. It does not change the server (the contract in
`server/internal/contract/contract.go` is locked) and it does not redesign any screen. It carries
real, encrypted, round-tripped data where the fixtures used to sit, slice by slice.

## Principles this seam inherits

1. **The client does all crypto; the server sees only ciphertext.** Diagnoses, dates, the contact
   graph, alias definitions, and the badge math all live in a key-derived encrypted blob on the
   device. The key never leaves the device. The server stores `opaque_id to ciphertext` and
   nothing readable.
2. **Existence is undetectable, so the client must not leak it either.** `GET /a/{id}` always
   returns a fixed 4096-byte payload (`AliasPayloadSize`); real ciphertext is padded to it and a
   miss returns decoy bytes of the same size and timing (verified in the server: a miss is a
   200 with id-seeded decoy bytes, never a 404). `POST /knock` always returns
   `{"status":"received"}`. So the client treats "decrypt failed" and "does not exist" as the same
   outcome: both produce a `null` resolution, which renders the existing uniform null state (the
   gray "No status shared right now" card for a public link, gray-nothing for a private one). This
   is existence-uniformity, and it is a distinct concern from staleness (principle 3). The client
   never branches UI or timing on miss-versus-decrypt-fail. The canonical viewer outcomes this maps
   onto are locked in `08-state-space.md`.
3. **The Live wallet pass fails closed to gray, never stale-blue.** This is the one place staleness
   matters, and it is scoped to the Live wallet pass, not to public resolution and not to the
   owner's app badge. Blue is valid only on a fresh confirmed read; if the pass cannot refresh, the
   server is unreachable, or the last sync is older than the freshness window
   (`WALLET_FRESH_HOURS`, 24h), the pass shows gray, never stale-blue (`03-design.md` "Fail closed
   to gray"; `src/ui/wallet/shared.tsx` `livePassState`). The owner's in-app badge is computed live from
   device state and is never stale; public resolution returns the current ciphertext or a decoy and
   has no staleness path of its own. A shed request (`429`/`503` on the non-sensitive endpoints)
   surfaces as gray, not as a scary error.
4. **Fixtures stay as the Storybook surface.** Stories must keep rendering without a network, so
   the data layer is injected (not imported globally). Storybook binds the fixture implementation;
   the app binds the real client. This keeps the visual gate fast and offline.

## The shape: two new layers under the existing screens

Today the app reads a fixture (`OWNER`) once at the composition root (`src/ui/App.tsx`) and threads
it to screens through props and a single `ScreenCtx`; no component imports fixtures directly, and
the badge math is already isolated as pure functions in `src/core/badge.ts`. So introducing an
injected boundary is a light change: replace the one `OWNER` import with a `PassportStore` the app
resolves, and bind that store to fixtures in Storybook. Nothing below the root changes.

We add two layers under that boundary:

- **`passport/src/api/` (transport).** A typed client over the contract: one function per endpoint
  (`getAlias`, `putAlias`, `getAccount`, `putAccount`, `deleteAccount`, `getInbox`, `putInbox`,
  `notify`, `registerPush`, `knock`, `knockReview`, `republish`, the Findable `resolve/register/
  release/report`, `health`), opaque-id validation (43-char base64url), the `X-Write-Token` and
  `X-Version` headers, and the gray-on-failure mapping. It knows nothing about plaintext.
- **`passport/src/crypto/` (the blind boundary).** Key derivation (passkey- or passphrase-derived
  root key), authenticated encryption (WebCrypto AES-GCM) of the device blob and alias payloads,
  fixed-size padding to `AliasPayloadSize`, and the id/token derivation, which is **not one
  mechanism**: an **alias id and its write token are random** (generated once at alias creation and
  stored in the device blob, since the server only validates an id and stores `hash(write-token)` on
  first PUT); the **account id is key-derived** from the owner's root key; and **routing tokens**
  (notify, knock) are **hashes** of pairwise or per-requester secrets. Plaintext goes in here and
  never comes back out through the api layer.

Screens consume a `PassportStore` interface (resolve alias, publish card, report result then
derive badge, knock, notify), which composes api + crypto and reuses the existing `core/badge.ts`
derivation rather than reimplementing it; the fixtures wire the same interface to in-memory data.
Device-state sync is a sibling surface, `AccountSync` (load/save the owner's encrypted account
blob, keyed off the root key), kept separate because it is used at onboarding/login/recovery
rather than per-screen and takes a root key the screen-facing store never needs. Nothing above
the boundary changes.

## Integration order

Each slice replaces one fixture path and ships only when its end-to-end test is green (see
Validation). Order is by dependency and by blast radius, simplest real read first.

1. **API client + crypto layer.** The two layers above, with no screen rewired yet. Encrypt then
   decrypt round-trips to a plaintext-equal value; ids and padding match the contract; existence
   uniformity holds (a miss is indistinguishable from a decrypt failure). This is the foundation
   everything else stands on, so it is first and it is the most heavily tested.
2. **A2 public resolution (`GET /a/{id}`).** The simplest real read: open a shared link, fetch the
   fixed-size payload, decrypt, render the public passport. Proves client plus crypto end to end
   against the live server, and proves the existence-uniform miss path (a miss or a decrypt failure
   produces a `null` resolution that renders the same uniform null state as a real-but-gray
   passport, with no distinguishing UI or timing). **Prerequisite:** cross-origin access, see the
   note below, because this is the first real browser call from sti.care to api.sti.care.
3. **Onboarding: passkey / account key + `acct` sync.** Mint the real key at signup, derive the
   account id, and round-trip the encrypted device blob through `GET/PUT /acct/{id}` with
   `X-Version`. Unlike an alias, an account miss is a real `404` (the id is key-derived and never
   shared, so a 404 only tells the owner "no sync blob yet"); first-run onboarding treats that 404
   as the empty-account case, not an error. Recovery passphrase is the only way back in (no
   server-side reset is possible).
4. **Publish the owner card + derive the badge.** `PUT /a/{id}` with `X-Write-Token` to publish the
   owner's alias payload, and derive plus persist the badge from a reported result. After this the
   badge is real, not a fixture.
5. **Knock / notify / circles.** `POST /knock/{id}` (uniform response), `POST /notify` by
   `tokenHash`, and push registration. The targeted-notify privacy caveat (recipient-set
   visibility) is answered by the scheduled cover broadcast, which ships on by default
   (`DrainSends` / `fanOutHeartbeat`, gated by `NotifyEnabled`, default on): a real due-send rides
   the same population-wide heartbeat as the cover wakes, so it is indistinguishable from the
   silent case. Data & storage carries the honest limits.

## Validation: every slice proves itself end to end

The standard for this work: **anything not validated end to end may as well not be working.** A
unit test that mocks the API proves the wiring compiles, not that real data flows. The dominant
failure mode here is a slice that looks wired but silently no-ops (fixtures still showing, a
key mismatch, a PUT that never round-trips), and only a real round-trip catches it.

So each slice lands with:

- **A round-trip integration test against the real endpoints** (the running server, not a mock):
  publish then resolve, assert the decrypted value equals what was published, and assert the
  byte-level contract (id shape, 4096-byte alias payload, uniform miss).
- **A Testing Library render test** for the user-visible flow (the repo's UI test tool; there is
  no Cypress). It drives the screen, or the whole app via its injectable store, with a stub store
  and asserts the rendered DOM reflects the resolved data, or the uniform gray on a miss.
- **An existence-uniformity assertion**: a missing id and an undecryptable id produce the same
  rendered state and no distinguishing client behavior.

A slice is not done until these are green. Crypto correctness (round-trip equality, tamper
rejection, padding) is unit-tested in addition, because it is cheap and the cost of getting it
wrong is silent data loss.

Slice 1's round-trip test runs against a **hermetic local instance** of the Go server (the server
already ships `server_test.go`, so it boots in-process for tests), which keeps the contract test
fast and offline and matches the project default of testing against the real datastore, not a
mock.

## Cross-origin access (built)

Slice 1 is same-process, but the moment the real browser at `sti.care` calls `api.sti.care`
(slice 2) it crosses an origin boundary, so the server must send CORS headers and answer the
`OPTIONS` preflight or the browser blocks the request. This is transport, not the contract (no
endpoint or shape changes), so it does not break the "contract is locked" rule.

This ships as a CORS allowlist on the server (`Server.cors`). A configured origin
(`STI_ALLOWED_ORIGINS`, matched exactly, no wildcard) gets `Access-Control-Allow-Origin`, the
allowed methods and request headers (including `X-Write-Token` and `X-Version`), and a genuine
preflight (one carrying `Access-Control-Request-Method`) is answered as a uniform `204`. A
disallowed or absent Origin gets no allow headers, so same-origin and non-browser callers are
untouched and unlisted browser origins are blocked at the reader. The middleware changes no response
body, so existence-uniformity on `GET /a` and `POST /knock` holds. The same-origin Netlify-proxy
alternative was not taken: routing all api traffic through Netlify cuts against the fixed-cost,
degrade-not-bill posture of the backend.

## Decisions

- **No per-user KDF salt.** The account id is derived from the root key, so a per-user salt could
  never be fetched before deriving that id (it is circular). Instead the passphrase path uses a
  fixed domain-separation salt, and the blind-store guarantee rests on the recovery passphrase being
  **app-generated with high entropy** (>= 128 bits, shown once at signup), so it is globally unique
  and unguessable. The onboarding flow (slice 3 part 2) must generate the phrase, never accept a
  user-chosen one; a user-chosen passphrase would need a memory-hard KDF (Argon2id) and a different
  account-addressing scheme.

## Open questions

- **Key storage and the passkey flow.** The recovery model is now realized in code: the root is
  phrase-derived (the recovery root), `PasskeyAuth` yields only the PRF output, and `auth/keyVault`
  (`wrapMaster`/`unwrapMaster`) wraps the root under it, so a passkey is a second credential over
  the same phrase-recoverable account, never standalone. What remains for the wiring slice: WHERE the
  `{credentialId, wrappedRoot}` lives (local storage) and the enroll/unlock UX. A passkey-only
  account must still never be createable.
- **Sibling-alias decorrelation (BUILT).** Republishing all of an owner's aliases on a state change
  used to fire one same-instant burst from the device, letting an observer correlate the opaque ids
  as one owner. Now `republishOwnerCard` hands two-or-more aliases to `POST /republish` as one batch,
  and the server applies each at an independent jittered time (`republish_queue` + `DrainRepublishes`,
  on by default), so the public card changes are decorrelated. See doc 18 for the built design and
  its honest limits (the batch is explicit to the blind-trusted, IP-stripped origin).
- **Deletion and export** remain open product items (Data & storage), unchanged by this seam.

---

Mechanics of the badge and aliases live in the [Design doc](/docs/design); what the server is and
why it is blind live in [Build & Deployment](10-build-backend-and-deployment.md).
