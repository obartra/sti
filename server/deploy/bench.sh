#!/usr/bin/env bash
#
# Load-test the origin to answer "what volume can this box handle?" honestly,
# per the repo's "no perf claim without a test" rule. Run it on the box against
# a throwaway instance on loopback, so it measures THIS hardware without going
# through Cloudflare (which would measure the edge) and without touching prod
# data. Requires `wrk`.
#
#   bash bench.sh          # spins up a throwaway instance and benchmarks it
#   bash bench.sh URL      # benchmarks an already-running instance at URL
#
set -euo pipefail
DUR="${DUR:-15s}"
THREADS="${THREADS:-2}"
CONNS="${CONNS:-64}"

command -v wrk >/dev/null || { echo "wrk not installed (apt-get install -y wrk)"; exit 1; }

OWN=0
URL="${1:-}"
if [ -z "$URL" ]; then
	BIN="${STIAPI_BIN:-/usr/local/bin/stiapi}"
	DB="$(mktemp -u)/bench.db"; mkdir -p "$(dirname "$DB")"
	STI_ADDR=127.0.0.1:8099 STI_DB_PATH="$DB" \
		STI_DECOY_SECRET="$(openssl rand -hex 32)" "$BIN" &
	BENCH_PID=$!; OWN=1; URL="http://127.0.0.1:8099"
	for _ in $(seq 1 40); do curl -sf "$URL/healthz" >/dev/null && break; sleep 0.25; done
	cleanup() { kill "$BENCH_PID" 2>/dev/null || true; rm -rf "$(dirname "$DB")"; }
	trap cleanup EXIT
fi

# Random 43-char base64url id, computed once per wrk request.
randid_lua() { cat <<'LUA'
local a="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
math.randomseed(os.time() + tonumber(tostring({}):sub(8)))
local function id() local s={} for i=1,43 do local n=math.random(1,#a); s[i]=a:sub(n,n) end return table.concat(s) end
LUA
}

read_lua="$(mktemp --suffix=.lua)"
{ randid_lua; echo 'request = function() return wrk.format("GET", "/a/" .. id()) end'; } > "$read_lua"

write_lua="$(mktemp --suffix=.lua)"
{ randid_lua
  echo 'wrk.method = "PUT"'
  echo 'wrk.headers["X-Write-Token"] = "benchtoken"'
  echo 'wrk.body = string.rep("A", 4096)'
  echo 'request = function() return wrk.format(nil, "/a/" .. id()) end'
} > "$write_lua"
trap 'rm -f "$read_lua" "$write_lua"' RETURN 2>/dev/null || true

echo "### target $URL  ($THREADS threads, $CONNS conns, $DUR each)"
echo; echo "## GET /healthz  (raw HTTP ceiling)"
wrk -t"$THREADS" -c"$CONNS" -d"$DUR" --latency "$URL/healthz"
echo; echo "## GET /a/{rand} (read / decoy path, the hot passport read)"
wrk -t"$THREADS" -c"$CONNS" -d"$DUR" --latency -s "$read_lua" "$URL"
echo; echo "## PUT /a/{rand} (write path, 4096B body, SQLite single writer)"
wrk -t"$THREADS" -c"$CONNS" -d"$DUR" --latency -s "$write_lua" "$URL"

rm -f "$read_lua" "$write_lua"
