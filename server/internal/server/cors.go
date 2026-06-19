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
	corsAllowMethods  = "GET, PUT, POST, OPTIONS"
	corsAllowHeaders  = contract.HeaderWriteToken + ", " + contract.HeaderVersion + ", Content-Type"
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
		if origin := r.Header.Get("Origin"); origin != "" && s.originAllowed(origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", corsAllowMethods)
			h.Set("Access-Control-Allow-Headers", corsAllowHeaders)
			h.Set("Access-Control-Expose-Headers", corsExposeHeaders)
			h.Set("Access-Control-Max-Age", corsMaxAge)
		}
		if r.Method == http.MethodOptions {
			// Preflight never reaches the mux or takes an inflight slot. It is a
			// uniform 204 regardless of the path or whether the origin was allowed
			// (a disallowed origin simply received no allow headers above).
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) originAllowed(origin string) bool {
	return slices.Contains(s.cfg.AllowedOrigins, origin)
}
