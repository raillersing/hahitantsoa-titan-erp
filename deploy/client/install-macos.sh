#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.client"

command -v docker >/dev/null 2>&1 || {
  echo "Docker Desktop est requis. Installe-le puis relance ce script." >&2
  exit 1
}
docker info >/dev/null 2>&1 || {
  echo "Docker Desktop doit être démarré et prêt avant l'installation." >&2
  exit 1
}

if [[ -e "$ENV_FILE" ]]; then
  echo "Configuration existante conservée : $ENV_FILE"
else
  cp "$SCRIPT_DIR/.env.client.example" "$ENV_FILE"
  secret_key="$(openssl rand -hex 32)"
  postgres_password="$(openssl rand -hex 24)"
  redis_password="$(openssl rand -hex 24)"
  admin_password="$(openssl rand -hex 12)"
  sed -i '' \
    -e "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$secret_key|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$postgres_password|" \
    -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$redis_password|" \
    -e "s|^DJANGO_ADMIN_PASSWORD=.*|DJANGO_ADMIN_PASSWORD=$admin_password|" \
    "$ENV_FILE"
  echo "Configuration créée : $ENV_FILE"
  echo "Compte initial : admin / $admin_password"
fi

cd "$ROOT_DIR"
docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/compose.yaml" up -d --build
echo "ERP démarré sur http://127.0.0.1:5173/"
