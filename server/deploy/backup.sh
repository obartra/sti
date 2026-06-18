#!/usr/bin/env bash
#
# Nightly consistent SQLite snapshot (works correctly with WAL via the backup
# API), gzipped, keeping the 7 most recent. Runs as the stiapi user.
set -euo pipefail
DB=/var/lib/stiapi/sti.db
DIR=/var/lib/stiapi/backups
ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$DIR/sti-$ts.db"

mkdir -p "$DIR"
sqlite3 "$DB" ".backup '$out'"
gzip -f "$out"

# Keep the 7 newest, drop the rest.
ls -1t "$DIR"/sti-*.db.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
