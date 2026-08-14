#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.client"
BACKUP_DIR="$ROOT_DIR/backups/client"

[[ -f "$ENV_FILE" ]] || { echo "Configuration absente : $ENV_FILE" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
cd "$ROOT_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
backup_file="$BACKUP_DIR/postgres-$stamp.dump"
docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/compose.yaml" exec -T db \
  sh -c 'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup_file"
echo "Sauvegarde créée : $backup_file"
