#!/usr/bin/env bash
# Simple Postgres backup for Twitter Helper.
# Usage: DATABASE_URL=postgres://... ./scripts/backup.sh [output_dir]
# Schedule via cron, e.g. daily:  0 3 * * *  /path/to/scripts/backup.sh /backups
set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/twitter_helper-$STAMP.sql.gz"

echo "Backing up to $FILE"
pg_dump "$DATABASE_URL" | gzip > "$FILE"

# Retain the 14 most recent backups.
ls -1t "$OUT_DIR"/twitter_helper-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
echo "Done."
