# Local development.
#
# The passport frontend talks to the Go API on :8080. Account creation (signUp)
# saves to that backend, so it MUST be running locally; otherwise the dev build
# falls back to https://api.sti.care, which sends no CORS headers for localhost
# origins and account creation fails.
#
# Run the backend and the web dev server (two shells, or `make dev` for both):
#   make backend
#   make web
#
# The web origins below must list whatever origin the browser uses (Vite dev is
# :5173; the preview tooling uses :5183). The decoy secret is a throwaway for
# local dev only.

WEB_ORIGINS ?= http://localhost:5173,http://127.0.0.1:5173,http://localhost:5183,http://127.0.0.1:5183
DEV_DECOY_SECRET ?= 00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
DEV_DB_PATH ?= /tmp/sti-dev.db

.PHONY: backend web dev
backend: ## Run the Go API on :8080 with CORS for the local web origins
	cd server && STI_DECOY_SECRET=$(DEV_DECOY_SECRET) STI_ALLOWED_ORIGINS=$(WEB_ORIGINS) STI_DB_PATH=$(DEV_DB_PATH) go run ./cmd/stiapi

web: ## Run the Vite dev server pointed at the local API
	cd passport && VITE_API_BASE_URL=http://127.0.0.1:8080 npm run dev

dev: ## Run backend + web together (interleaved output; two shells is cleaner)
	$(MAKE) -j2 backend web
