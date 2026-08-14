#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.client"

[[ -f "$ENV_FILE" ]] || { echo "Configuration absente : $ENV_FILE" >&2; exit 1; }
cd "$ROOT_DIR"
docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/compose.yaml" ps
curl -fsS -i --max-time 10 http://127.0.0.1:5173/healthz/
curl -fsS -i --max-time 10 http://127.0.0.1:5173/readyz/
