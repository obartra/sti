# Local development and the gates CI runs.
#
# Every gate below is exactly what CI runs: the workflows call these targets
# instead of duplicating the commands, so there is one source of truth. Run
# `make check` to reproduce the fast gates before pushing, or `make ci` for
# everything.
#
# Local dev: the passport frontend talks to the Go API on :8080. Account creation
# (signUp) saves to that backend, so it MUST be running locally; otherwise the dev
# build falls back to https://api.sti.care, which sends no CORS headers for
# localhost origins and account creation fails.
#
#   make backend   # the Go API
#   make web       # the Vite dev server
#   make dev       # both
#
# The web origins below must list whatever origin the browser uses (Vite dev is
# :5173; the preview tooling uses :5183). The decoy secret is a throwaway for
# local dev only.

WEB_ORIGINS ?= http://localhost:5173,http://127.0.0.1:5173,http://localhost:5183,http://127.0.0.1:5183
DEV_DECOY_SECRET ?= 00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
DEV_DB_PATH ?= /tmp/sti-dev.db

.PHONY: help backend web dev \
	check-root check-web test-integration test-e2e check-server vulncheck smoke \
	check ci build-web build-server build-release \
	secrets secrets-pull secrets-diff secrets-sync secrets-edit gen-vapid gen-decoy gen-admin

help: ## List the targets
	@grep -hE '^[a-z][a-zA-Z0-9_-]*:.*## ' $(MAKEFILE_LIST) | sort | awk -F':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

## --- Local dev ---

backend: ## Run the Go API on :8080 with CORS for the local web origins
	cd server && STI_DECOY_SECRET=$(DEV_DECOY_SECRET) STI_ALLOWED_ORIGINS=$(WEB_ORIGINS) STI_DB_PATH=$(DEV_DB_PATH) go run ./cmd/stiapi

web: ## Run the Vite dev server pointed at the local API
	cd passport && VITE_API_BASE_URL=http://127.0.0.1:8080 npm run dev

dev: ## Run backend + web together (interleaved output; two shells is cleaner)
	$(MAKE) -j2 backend web

## --- Gates (CI calls these) ---

check-root: ## Root: prettier + eslint + node tests
	npm run format:check
	npm run lint
	npm test

check-web: ## Passport: lint + typecheck + unit tests
	cd passport && npm run lint
	cd passport && npm run typecheck
	cd passport && npm run test:cov

test-integration: ## Passport API client against a real Go store
	cd passport && npm run test:integration

test-e2e: ## Passport Playwright journeys (needs a browser)
	cd passport && npm run test:e2e

check-server: ## Server: gofmt + vet + go test + alert-script tests
	@cd server && { test -z "$$(gofmt -l .)" || { echo "needs gofmt:"; gofmt -l .; exit 1; }; }
	cd server && go vet ./...
	cd server && go test ./...
	cd server && bash deploy/alert_test.sh

vulncheck: ## Server: govulncheck over the stdlib + deps the code calls
	cd server && go run golang.org/x/vuln/cmd/govulncheck@v1.4.0 ./...

smoke: ## Server: build, boot a throwaway instance, run the smoke script
	cd server && go build -o /tmp/stiapi ./cmd/stiapi
	cd server && bash -c 'STI_DECOY_SECRET="$$(openssl rand -hex 32)" STI_ADDR=127.0.0.1:8080 STI_DB_PATH="$$(mktemp -u).db" /tmp/stiapi & srv=$$!; trap "kill $$srv 2>/dev/null" EXIT; for _ in $$(seq 1 40); do curl -sf http://127.0.0.1:8080/healthz >/dev/null && break; sleep 0.25; done; bash deploy/smoke.sh http://127.0.0.1:8080'

## --- Aggregates ---

check: check-root check-web check-server ## Fast pre-push gates (no integration/e2e)

ci: check-root check-web test-integration test-e2e check-server vulncheck smoke ## Everything CI runs

## --- Build ---

build-web: ## Build the passport frontend
	cd passport && npm run build

build-server: ## Build the Go server
	cd server && go build ./...

build-release: ## Static linux binary, what the deploy workflow ships
	cd server && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /tmp/stiapi ./cmd/stiapi

## --- Ops ---

secrets: ## Manage server env secrets, e.g. make secrets ARGS="list"
	cd server && go run ./cmd/secrets $(ARGS)

secrets-pull: ## Adopt the box's current env into the local store (SSH=root@origin.sti.care)
	cd server && SECRETS_SSH=$(SSH) go run ./cmd/secrets pull

secrets-diff: ## Preview what a sync would change on the box (SSH=root@origin.sti.care)
	cd server && SECRETS_SSH=$(SSH) go run ./cmd/secrets diff

secrets-sync: ## Push the store to the box and restart the service (SSH=root@origin.sti.care)
	cd server && SECRETS_SSH=$(SSH) go run ./cmd/secrets sync

secrets-edit: ## Edit the whole encrypted store in $$EDITOR
	cd server && go run ./cmd/secrets edit

gen-vapid: ## Generate and store a fresh Web Push VAPID keypair (rotate push keys)
	cd server && go run ./cmd/secrets gen-vapid

gen-decoy: ## Generate and store a fresh STI_DECOY_SECRET (rotate the decoy key)
	cd server && go run ./cmd/secrets gen-decoy

gen-admin: ## Enable the admin surface: store STI_ADMIN_TOKEN + STI_ADMIN_ENABLED=true
	cd server && go run ./cmd/secrets gen-admin
