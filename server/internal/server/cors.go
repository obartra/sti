package server

import (
	"net/http"
	"slices"

	"sti.care/api/internal/contract"
)

// The methods and request headers a browser passport client uses, plus the one
// response header it must be allowed to read (the account-sync version). No
// credentials are involved: the write token is a header, not a cookie, so
// Access-Control-Allow-Credentials is deliberately never set.
var (
	// DELETE rides the Findable release (DELETE /u/{name}) and the account-sync
	// delete (DELETE /acct/{id}); it is never a CORS-simple method, so omitting it
	// here makes the browser preflight block those calls before they are sent.
	corsAllowMethods = "GET, PUT, POST, DELETE, OPTIONS"
	// X-Expires-At rides the alias PUT (doc 16); Authorization carries the admin
	// bearer on /admin/* (doc 20). Both MUST be allowed here or the browser's
	// preflight rejects the request before it is sent (Node-based integration tests
	// don't exercise CORS, so this is browser-only). Authorization is a request
	// header only; no cookie is involved, so Allow-Credentials stays unset.
	corsAllowHeaders  = contract.HeaderWriteToken + ", " + contract.HeaderVersion + ", " + contract.HeaderExpiresAt + ", Authorization, Content-Type"
	corsExposeHeaders = contract.HeaderVersion
	corsMaxAge        = "86400"
)

// cors applies an allowlisted CORS policy and answers preflight. Origins are
// matched exactly (no wildcard), so only configured front-ends may read api
// responses from a browser. A disallowed or absent Origin gets no allow headers,
// which leaves same-origin and non-browser callers untouched and blocks
// unlisted browser origins at the reader. It does not change the response body,
// so existence-uniformity on GET /a and POST /knock is unaffected: a browser
// either reads the same uniform bytes or is blocked from reading them at all.
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The response varies on Origin whether or not we allow it, so always
		// signal that to caches; emitting Vary only on the allowed branch would
		// let a shared cache serve the wrong CORS variant.
		w.Header().Add("Vary", "Origin")
		if origin := r.Header.Get("Origin"); origin != "" && s.originAllowed(origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Methods", corsAllowMethods)
			h.Set("Access-Control-Allow-Headers", corsAllowHeaders)
			h.Set("Access-Control-Expose-Headers", corsExposeHeaders)
			h.Set("Access-Control-Max-Age", corsMaxAge)
		}
		// Answer only a genuine preflight here (it carries Access-Control-Request-
		// Method), before shed, as a uniform 204 regardless of path or whether the
		// origin was allowed. A bare OPTIONS without that header is not a preflight
		// and falls through to the mux under the normal load-shedding path, so it
		// cannot ride an un-shed, un-rate-limited shortcut.
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// The native app shells (doc 26) load the web build fullscreen from a fixed
// origin the system WebView assigns: capacitor://localhost on iOS and
// https://localhost on Android. These are constants of the shell, not of any one
// deployment, so the server allows them directly rather than having every
// environment remember to add them to STI_ALLOWED_ORIGINS (which stays for the
// deployment-specific web origins). No credentials are involved, so allowing a
// fixed extra origin only lets that WebView read the same uniform, opaque bytes
// any client already can.
var nativeShellOrigins = []string{
	"capacitor://localhost",
	"https://localhost",
}

func (s *Server) originAllowed(origin string) bool {
	return slices.Contains(s.cfg.AllowedOrigins, origin) ||
		slices.Contains(nativeShellOrigins, origin)
}
