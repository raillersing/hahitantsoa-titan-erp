#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.client"

[[ -f "$ENV_FILE" ]] || { echo "Configuration absente : $ENV_FILE" >&2; exit 1; }
cd "$ROOT_DIR"
docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/compose.yaml" exec -T backend \
  python backend/manage.py shell -c \
  'import os; from django.contrib.auth import get_user_model; User=get_user_model(); username=os.environ["DJANGO_ADMIN_USERNAME"]; user,_=User.objects.get_or_create(username=username); user.email=os.environ["DJANGO_ADMIN_EMAIL"]; user.is_active=True; user.is_staff=True; user.is_superuser=True; user.set_password(os.environ["DJANGO_ADMIN_PASSWORD"]); user.save(); print(f"Administrateur {username} prêt.")'
