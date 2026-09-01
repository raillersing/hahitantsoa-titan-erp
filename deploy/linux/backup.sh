#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/production.env"
BACKUP_DIR="$SCRIPT_DIR/backups"

[[ -f "$ENV_FILE" ]] || { echo "Configuration absente : $ENV_FILE" >&2; exit 1; }
umask 077
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/postgres-$stamp.dump"
docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/compose.yaml" exec -T db \
  sh -c 'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup_file"
echo "Sauvegarde PostgreSQL créée : $backup_file"
