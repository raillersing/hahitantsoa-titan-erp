#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/production.env"
backup_file="${1:-}"

[[ -f "$ENV_FILE" ]] || { echo "Configuration absente : $ENV_FILE" >&2; exit 1; }
[[ -n "$backup_file" && -f "$backup_file" ]] || {
  echo "Usage : $0 <sauvegarde-postgresql.dump>" >&2
  exit 1
}

restore_database="restore_verification"
container_name="hahitantsoa-restore-$(date -u +%Y%m%d%H%M%S)"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --rm --name "$container_name" --network none \
  --env-file "$ENV_FILE" \
  -e "POSTGRES_DB=$restore_database" \
  postgres:17.10-bookworm >/dev/null

for attempt in $(seq 1 30); do
  if docker exec "$container_name" sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$container_name" sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null
docker cp "$backup_file" "$container_name:/backup.dump"
docker exec "$container_name" sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --exit-on-error --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" /backup.dump'

docker exec "$container_name" sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM django_migrations LIMIT 1"' \
  | grep -qx '1'

echo "Restauration vérifiée dans un conteneur PostgreSQL éphémère."
