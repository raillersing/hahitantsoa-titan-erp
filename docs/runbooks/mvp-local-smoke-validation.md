# MVP local smoke validation

Ce runbook valide le socle MVP local apres une modification frontend ou une evolution controlee des APIs read-only existantes.

Il utilise `scripts/dev/erp-logged-run` pour conserver la sortie complete dans `logs/terminal/`.

Ne jamais ajouter dans ce bloc une commande qui affiche `.env`, un mot de passe, un token ou un autre secret.

Depuis la racine du repository :

```sh
scripts/dev/erp-logged-run mvp-local-smoke-validation <<'EOF'
set -euo pipefail

cleanup() {
  docker compose --env-file .env down || true
}
trap cleanup EXIT

git branch --show-current
git status --short

.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .

docker compose --env-file .env build backend
docker compose --env-file .env up -d db redis backend
docker compose --env-file .env exec backend python backend/manage.py check

docker compose --env-file .env exec backend python -m pytest tests/backend/test_reservations_availability_summary_api.py -q
docker compose --env-file .env exec backend python -m pytest tests/backend/test_reservations_available_item_previews_api.py -q
docker compose --env-file .env exec backend python -m pytest tests/backend/test_inventory_item_readonly_api.py -q
docker compose --env-file .env exec backend python -m pytest tests/backend/test_inventory_item_api_auth.py -q

if [ -f tests/backend/test_openapi_schema.py ]; then
  docker compose --env-file .env exec backend python -m pytest tests/backend/test_openapi_schema.py -q
fi

cd frontend
npm install
npm run build
npm test
cd ..

find backend/apps/reservations -path "*/migrations/*" -type f | sort || true
find backend/apps/reservations -maxdepth 1 -type f | grep -E "models.py|admin.py" || true

git diff --check
git diff --name-status
git diff --stat
git status --short
EOF
```

Le bloc arrete proprement les services Docker Compose via son `trap`, y compris lorsqu'une validation echoue.

Ce smoke test ne valide pas un workflow de reservation persistante, une API d'ecriture, un login frontend, un workflow commercial ou un deploiement production.
