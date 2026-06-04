# Local Development Runbook

## Statut

Ce runbook couvre uniquement la premiere infrastructure locale PostgreSQL et Redis.

La mise en route des conteneurs ne doit etre effectuee qu'apres revue du diff et validation technique.

## Prerequis

- Python 3.14 pour le backend Django minimal Foundation.
- Docker installe localement.
- Docker Compose disponible via `docker compose`.
- Acces au repository depuis un terminal positionne a la racine du projet.

## Variables locales

Copier ulterieurement l'exemple d'environnement avant tout demarrage local :

```sh
cp .env.example .env
```

Remplacer les mots de passe d'exemple dans `.env` par des valeurs locales.

Ne jamais commiter `.env`. Seul `.env.example` doit rester versionne.

Variables Django supplementaires a completer ou conserver localement selon le besoin :

```sh
DJANGO_CSRF_TRUSTED_ORIGINS=
DJANGO_SECURE_SSL_REDIRECT=False
DJANGO_SESSION_COOKIE_SECURE=False
DJANGO_CSRF_COOKIE_SECURE=False
```

Les options secure restent a `False` en local sauf test explicite. Ne pas ajouter de domaine de production dans `.env.example`.

## Validation de la configuration

Commande prevue pour valider la configuration Compose sans demarrer les services :

```sh
docker compose --env-file .env.example config --quiet
```

## Demarrage et arret prevus

Commandes prevues apres revue et validation du diff :

```sh
docker compose --env-file .env up -d db redis
docker compose stop db redis
docker compose down
```

## Verification PostgreSQL

Commande prevue pour verifier PostgreSQL depuis le conteneur :

```sh
docker compose --env-file .env exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Verification Redis

Commande prevue pour verifier Redis depuis le conteneur :

```sh
docker compose --env-file .env exec redis sh -lc 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
```

## Backend Django minimal

Le backend Django minimal F5 se verifie localement depuis la racine du repository.

Creer ulterieurement l'environnement virtuel local :

```sh
python3 -m venv .venv
```

Installer le projet en mode editable :

```sh
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
```

Charger temporairement les variables locales depuis `.env` dans le shell courant :

```sh
set -a && source .env && set +a
```

Executer la verification Django minimale :

```sh
.venv/bin/python backend/manage.py check
```

Ne pas executer `migrate` avant validation explicite d'une phase ulterieure.

Ne jamais commiter `.env`. Seul `.env.example` doit rester versionne.

## Qualite backend locale

Installer les dependances backend de developpement :

```sh
.venv/bin/python -m pip install -e ".[dev]"
```

Verifier le formatage Python avec Ruff :

```sh
.venv/bin/python -m ruff format --check .
```

Executer le lint Python avec Ruff :

```sh
.venv/bin/python -m ruff check .
```

Executer le system check Django avec les variables locales chargees temporairement :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Executer les tests Foundation avec les variables locales chargees temporairement :

```sh
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Ne pas executer `migrate` ou `makemigrations` pendant les phases Foundation F6/F7.

Ne jamais commiter `.env`.

## Health endpoint backend

F8 ajoute `GET /healthz/` comme liveness check backend minimal.

Ce endpoint retourne uniquement `{"status": "ok"}`. Il ne teste pas PostgreSQL, Redis, les taches asynchrones ou un readiness applicatif complet.

Le test local du health endpoint se fait via pytest :

```sh
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Ne pas documenter de test `curl` tant qu'aucun serveur Django local n'est demarre dans cette phase.

## Backend Docker Compose service

F9 ajoute un service Compose `backend` pour le developpement local. Il utilise Django `runserver` et n'est pas destine a la production.

Valider la configuration Compose sans demarrer les services :

```sh
docker compose --env-file .env config --quiet
```

Construire l'image backend locale apres revue du diff :

```sh
docker compose --env-file .env build backend
```

Demarrer PostgreSQL et le backend local :

```sh
docker compose --env-file .env up -d db backend
```

Verifier l'etat des services :

```sh
docker compose --env-file .env ps
```

Pendant les premieres secondes de demarrage, le service `backend` peut apparaitre en etat `starting`. Attendre qu'il passe en `healthy` avant de conclure que le liveness check est disponible.

Tester le liveness check minimal :

```sh
curl -i http://127.0.0.1:8000/healthz/
```

Verifier que les tests backend sont disponibles dans le conteneur :

```sh
docker compose --env-file .env exec backend test -d /app/tests/backend
docker compose --env-file .env exec backend python -m pytest --version
```

Lancer les tests backend depuis le conteneur backend :

```sh
docker compose --env-file .env exec backend python -m pytest tests/backend -q
```

Consulter les logs backend :

```sh
docker compose --env-file .env logs --tail=80 backend
```

Arreter et nettoyer les services Compose locaux :

```sh
docker compose --env-file .env down
```

Ne pas executer `migrate` pendant F9.

## Migrations Django standards locales

F11 valide uniquement les migrations Django standards des apps integrees `admin`, `auth`, `contenttypes` et `sessions` dans PostgreSQL local.

Demarrer PostgreSQL et le backend local :

```sh
docker compose --env-file .env up -d db backend
```

Appliquer les migrations Django standards :

```sh
docker compose --env-file .env exec backend python backend/manage.py migrate --noinput
```

Afficher l'etat des migrations :

```sh
docker compose --env-file .env exec backend python backend/manage.py showmigrations
```

Consulter les logs backend :

```sh
docker compose --env-file .env logs --tail=80 backend
```

Arreter les services Compose locaux :

```sh
docker compose --env-file .env down
```

## Structure des packages de domaines backend

F13 ajoute uniquement une structure de packages Python preparatoires sous `backend/apps/`.

Verifier les fichiers crees :

```sh
find backend/apps -maxdepth 3 -type f | sort
```

Verifier qu'aucun fichier applicatif metier interdit n'a ete cree :

```sh
find backend/apps \
  \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "apps.py" \
     -o -name "admin.py" \
     -o -name "tests.py" \
     -o -path "*/migrations/*" \) \
  -type f -print | sort
```

Executer les controles habituels :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Aucune migration ne doit etre creee en F13.

## Activation minimale de l'app common

F14 active uniquement `apps.common.apps.CommonConfig` dans `INSTALLED_APPS`.

Verifier l'activation dans les settings :

```sh
grep -Rni "backend.apps.*apps.*Config" backend/config/settings.py
```

Verifier les fichiers du domaine common :

```sh
find backend/apps/common -maxdepth 2 -type f | sort
```

Verifier qu'aucun fichier applicatif metier interdit n'a ete cree :

```sh
find backend/apps \
  \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -name "tests.py" \
     -o -path "*/migrations/*" \) \
  -type f -print | sort
```

Executer les controles habituels :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Aucune migration ne doit etre creee en F14.

Ne pas utiliser `docker compose down -v` sans decision explicite : cela supprimerait les volumes PostgreSQL/Redis.

Cette etape n'ajoute aucune migration metier.

## Socle commun abstrait

F15 ajoute uniquement des modeles abstraits techniques dans `apps.common`.

Verifier les fichiers du domaine common :

```sh
find backend/apps/common -maxdepth 2 -type f | sort
```

Verifier qu'aucun fichier applicatif metier interdit n'a ete cree en dehors du modele abstrait common autorise :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \) -prune \
  -o \( -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -name "tests.py" \
     -o -path "*/migrations/*" \) \
  -type f -print | sort
```

Verifier l'absence de migrations :

```sh
find backend/apps -path "*/migrations/*" -print | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations common --check --dry-run
```

Executer les controles habituels :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Aucune migration ne doit etre creee en F15.

## Activation minimale de l'app inventory

F16 active uniquement `apps.inventory.apps.InventoryConfig` dans `INSTALLED_APPS`.

Verifier l'activation dans les settings :

```sh
grep -Rni "apps.inventory.apps.InventoryConfig" backend/config/settings.py
```

Verifier les fichiers du domaine inventory :

```sh
find backend/apps/inventory -maxdepth 2 -type f | sort
```

Verifier qu'aucun fichier applicatif metier interdit n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" -o -path "backend/apps/inventory/apps.py" \) -prune \
  -o \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -name "tests.py" \
     -o -path "*/migrations/*" \) \
  -type f -print | sort
```

Verifier l'absence de migrations inventory :

```sh
find backend/apps -path "*/migrations/*" -print | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles habituels :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Aucune migration ne doit etre creee en F16.

## Garde-fou Titan inventory

F17 ajoute uniquement un garde-fou pur Python dans `apps.inventory` pour formaliser les types d'elements autorises dans Titan.

Verifier les fichiers du domaine inventory :

```sh
find backend/apps/inventory -maxdepth 2 -type f | sort
```

Verifier qu'aucun fichier applicatif metier interdit n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" -o -path "backend/apps/inventory/apps.py" -o -path "backend/apps/inventory/scope.py" \) -prune \
  -o \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -name "tests.py" \
     -o -path "*/migrations/*" \) \
  -type f -print | sort
```

Verifier l'absence de migrations inventory :

```sh
find backend/apps -path "*/migrations/*" -print | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles habituels :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Aucune migration ne doit etre creee en F17.

## Modele InventoryItem

F18 ajoute le premier modele concret minimal `InventoryItem` et une migration initiale inventory controlee.

Verifier les fichiers crees :

```sh
find backend/apps/inventory -maxdepth 3 -type f | sort
```

Verifier la migration creee :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
```

Verifier qu'aucun fichier applicatif metier interdit n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \
     -o -path "backend/apps/inventory/apps.py" \
     -o -path "backend/apps/inventory/scope.py" \
     -o -path "backend/apps/inventory/models.py" \) -prune \
  -o \( -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -name "tests.py" \) \
  -type f -print | sort
```

Verifier qu'aucune nouvelle migration inventory n'est necessaire apres creation de la migration initiale :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles habituels :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Valider la migration dans PostgreSQL local via Compose :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
docker compose --env-file .env exec backend python backend/manage.py migrate --noinput
docker compose --env-file .env exec backend python backend/manage.py showmigrations inventory
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F18 ne cree aucun endpoint API, serializer, viewset, admin, stock movement, disponibilite, reservation, facturation ou logique logistique.

## Validation DB InventoryItem

F19 ajoute des tests de persistance DB pour `InventoryItem` sans nouvelle migration.

Verifier les fichiers crees :

```sh
find backend/apps/inventory -maxdepth 3 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est creee :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Verifier qu'aucun fichier applicatif metier interdit n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \
     -o -path "backend/apps/inventory/apps.py" \
     -o -path "backend/apps/inventory/scope.py" \
     -o -path "backend/apps/inventory/models.py" \) -prune \
  -o \( -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \) \
  -type f -print | sort
```

Executer les controles habituels :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Relancer une validation Docker avec migration et readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
docker compose --env-file .env exec backend python backend/manage.py migrate --noinput
docker compose --env-file .env exec backend python backend/manage.py showmigrations inventory
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F19 ne cree aucun endpoint API, serializer, viewset, admin, modele ou migration nouvelle.

## Serializer InventoryItem

F20 ajoute un serializer DRF minimal pour `InventoryItem` sans endpoint API.

Verifier les fichiers crees :

```sh
find backend/apps/inventory -maxdepth 3 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est creee :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Verifier qu'aucun endpoint, route, view, viewset ou admin n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \
     -o -path "backend/apps/inventory/apps.py" \
     -o -path "backend/apps/inventory/scope.py" \
     -o -path "backend/apps/inventory/models.py" \
     -o -path "backend/apps/inventory/serializers.py" \) -prune \
  -o \( -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \) \
  -type f -print | sort
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env up -d backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F20 ne cree aucune migration, aucun endpoint API, aucune URL, aucune view, aucun viewset et aucun admin.

## API read-only InventoryItem

F21 ajoute une API read-only minimale pour `InventoryItem`.

Verifier les fichiers crees :

```sh
find backend/apps/inventory -maxdepth 3 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est creee :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Verifier qu'aucun viewset ou admin n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \
     -o -path "backend/apps/inventory/apps.py" \
     -o -path "backend/apps/inventory/scope.py" \
     -o -path "backend/apps/inventory/models.py" \
     -o -path "backend/apps/inventory/serializers.py" \
     -o -path "backend/apps/inventory/views.py" \
     -o -path "backend/apps/inventory/urls.py" \) -prune \
  -o \( -name "viewsets.py" \
     -o -name "admin.py" \) \
  -type f -print | sort
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env up -d backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F21 ne cree aucune migration, aucun modele, aucun serializer supplementaire, aucun viewset, aucun router et aucun admin.

## Documentation OpenAPI minimale

F22 ajoute un schema OpenAPI avec drf-spectacular pour usage local/dev.

Verifier les fichiers config et tests :

```sh
find backend/config -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est creee :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Verifier qu'aucun viewset ou admin n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \
     -o -path "backend/apps/inventory/apps.py" \
     -o -path "backend/apps/inventory/scope.py" \
     -o -path "backend/apps/inventory/models.py" \
     -o -path "backend/apps/inventory/serializers.py" \
     -o -path "backend/apps/inventory/views.py" \
     -o -path "backend/apps/inventory/urls.py" \) -prune \
  -o \( -name "viewsets.py" \
     -o -name "admin.py" \) \
  -type f -print | sort
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier OpenAPI puis readiness :

```sh
docker compose --env-file .env up -d backend --force-recreate
curl -i http://127.0.0.1:8000/api/schema/?format=json
curl -i http://127.0.0.1:8000/api/docs/swagger/
curl -i http://127.0.0.1:8000/api/docs/redoc/
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F22 ne cree aucune migration, aucun endpoint d'ecriture, aucun viewset, aucun router et aucun admin.

## Authentification API inventory

F23 protege l'API inventory read-only avec `IsAuthenticated`.

Verifier les fichiers modifies et crees :

```sh
find backend/apps/inventory -maxdepth 3 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est creee :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Verifier qu'aucun viewset ou admin n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \
     -o -path "backend/apps/inventory/apps.py" \
     -o -path "backend/apps/inventory/scope.py" \
     -o -path "backend/apps/inventory/models.py" \
     -o -path "backend/apps/inventory/serializers.py" \
     -o -path "backend/apps/inventory/views.py" \
     -o -path "backend/apps/inventory/urls.py" \) -prune \
  -o \( -name "viewsets.py" \
     -o -name "admin.py" \) \
  -type f -print | sort
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier l'authentification minimale :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/api/v1/inventory/items/
curl -i http://127.0.0.1:8000/api/schema/?format=json
curl -i http://127.0.0.1:8000/api/docs/swagger/
curl -i http://127.0.0.1:8000/api/docs/redoc/
curl -i http://127.0.0.1:8000/healthz/
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

Sans authentification, `/api/v1/inventory/items/` doit etre refuse. Les endpoints Foundation publics restent accessibles.

F23 ne cree aucune migration, aucun role metier avance, aucune permission custom, aucun endpoint d'ecriture, aucun viewset, aucun router et aucun admin.

## Login/logout session DRF dev/local

F24 ajoute les routes DRF session login/logout pour la Browsable API :

- `/api-auth/login/`
- `/api-auth/logout/`

Verifier les fichiers config et tests :

```sh
find backend/config -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est creee :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Verifier qu'aucun viewset ou admin n'a ete cree :

```sh
find backend/apps \
  \( -path "backend/apps/common/models.py" \
     -o -path "backend/apps/inventory/apps.py" \
     -o -path "backend/apps/inventory/scope.py" \
     -o -path "backend/apps/inventory/models.py" \
     -o -path "backend/apps/inventory/serializers.py" \
     -o -path "backend/apps/inventory/views.py" \
     -o -path "backend/apps/inventory/urls.py" \) -prune \
  -o \( -name "viewsets.py" \
     -o -name "admin.py" \) \
  -type f -print | sort
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier les routes publiques et protegees :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/api-auth/login/
curl -i http://127.0.0.1:8000/api-auth/logout/
curl -i http://127.0.0.1:8000/api/v1/inventory/items/
curl -i http://127.0.0.1:8000/api/schema/?format=json
curl -i http://127.0.0.1:8000/api/docs/swagger/
curl -i http://127.0.0.1:8000/api/docs/redoc/
curl -i http://127.0.0.1:8000/healthz/
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

`/api-auth/login/` et `/api-auth/logout/` servent a la Browsable API en dev/local. L'API inventory reste protegee sans session.

F24 ne cree aucun JWT, token auth, role metier, groupe metier, permission custom, endpoint d'ecriture, viewset, router, admin ou migration.

## Seed dev user local

F25 ajoute une commande Django locale pour creer ou mettre a jour un utilisateur standard de developpement :

```sh
python backend/manage.py seed_dev_user
```

La commande lit `DJANGO_DEV_USERNAME`, `DJANGO_DEV_PASSWORD` et `DJANGO_DEV_EMAIL` depuis l'environnement. `DJANGO_DEV_EMAIL` est optionnel. Ne jamais commiter de mot de passe local.

Verifier la structure des fichiers :

```sh
find backend/apps/common -maxdepth 5 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier l'absence de migration nouvelle :

```sh
find backend/apps -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Verifier le comportement avec variables manquantes :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py seed_dev_user || true
```

Verifier le comportement avec variables presentes :

```sh
set -a && source .env && set +a && \
DJANGO_DEV_USERNAME=dev.local \
DJANGO_DEV_PASSWORD='<mot-de-passe-local-non-commite>' \
DJANGO_DEV_EMAIL='dev.local@example.test' \
.venv/bin/python backend/manage.py seed_dev_user
```

Si `.env` pointe PostgreSQL vers l'hote Compose `db`, cette commande doit etre executee depuis le conteneur backend ou avec une base locale resoluble depuis l'hote.

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    DJANGO_DEV_USERNAME=dev.local DJANGO_DEV_PASSWORD="<mot-de-passe-local-non-commite>" DJANGO_DEV_EMAIL="dev.local@example.test" python backend/manage.py seed_dev_user &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier les routes utiles :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/api-auth/login/
curl -i http://127.0.0.1:8000/api/v1/inventory/items/
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

Sans authentification, `/api/v1/inventory/items/` doit rester refuse. `/api-auth/login/` et `/readyz/` restent utiles pour valider le parcours local/dev.

F25 ne cree aucune migration, aucun modele, aucun serializer, aucune view, aucun endpoint, aucun JWT/token, aucun role metier, aucun groupe metier et aucune permission custom.

## Seed demo inventory local

F26 ajoute une commande Django locale pour creer ou mettre a jour des donnees `InventoryItem` de demonstration conformes Titan :

```sh
python backend/manage.py seed_demo_inventory
```

Verifier la structure des fichiers :

```sh
find backend/apps/inventory -maxdepth 5 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier l'absence de migration nouvelle :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer la commande de seed demo inventory :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py seed_demo_inventory
```

Si `.env` pointe PostgreSQL vers l'hote Compose `db`, cette commande doit etre executee depuis le conteneur backend ou avec une base locale resoluble depuis l'hote.

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python backend/manage.py seed_demo_inventory &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier les routes utiles :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/api-auth/login/
curl -i http://127.0.0.1:8000/api/v1/inventory/items/
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

Sans authentification, `/api/v1/inventory/items/` doit rester refuse. Les donnees de demonstration ne doivent contenir que `material`, `article` et `material_pack`, jamais local, salle, lieu, service annexe ou service evenementiel.

F26 ne cree aucune migration, aucun modele, aucun serializer, aucune view, aucun endpoint, aucun endpoint d'ecriture inventory, aucun JWT/token, aucun role metier, aucun groupe metier et aucune permission custom.

## Smoke test inventory authentifie

F27 ajoute un smoke test du parcours inventory authentifie avec les donnees de demonstration locales.

Verifier la structure des tests :

```sh
find tests/backend -maxdepth 1 -type f | sort
```

Verifier l'absence de migration nouvelle :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python -m pytest
  '
```

Relancer le backend et verifier les routes utiles :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/api-auth/login/
curl -i http://127.0.0.1:8000/api/v1/inventory/items/
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

Sans authentification, `/api/v1/inventory/items/` doit rester refuse. Le smoke test F27 valide separement que l'utilisateur seed local authentifie obtient `HTTP 200` et que les donnees exposees restent limitees aux kinds Titan autorises.

F27 ne cree aucune migration, aucun modele, aucun serializer, aucune view, aucun endpoint, aucun endpoint d'ecriture inventory, aucun JWT/token, aucun role metier, aucun groupe metier et aucune permission custom.

## Smoke test detail inventory read-only

F28 ajoute un smoke test du detail inventory authentifie et confirme que l'API inventory reste read-only.

Verifier la structure des tests :

```sh
find tests/backend -maxdepth 1 -type f | sort
```

Verifier l'absence de migration nouvelle :

```sh
find backend/apps/inventory -path "*/migrations/*" -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_inventory_detail_readonly_smoke.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python -m pytest
  '
```

Relancer le backend et verifier les routes utiles :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/api-auth/login/
curl -i http://127.0.0.1:8000/api/v1/inventory/items/
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

Sans authentification, `/api/v1/inventory/items/` doit rester refuse. Le smoke test F28 valide separement que l'utilisateur seed local authentifie obtient `HTTP 200` sur la liste et le detail, et que POST, PUT, PATCH et DELETE restent refuses.

F28 ne cree aucune migration, aucun modele, aucun serializer, aucune view, aucun endpoint, aucun endpoint d'ecriture inventory, aucun JWT/token, aucun role metier, aucun groupe metier et aucune permission custom.

## Socle disponibilite inventory

F29 ajoute le modele `InventoryAvailability` pour preparer les futures periodes d'indisponibilite ou de reservation d'un `InventoryItem`.

Verifier la structure des fichiers :

```sh
find backend/apps/inventory -maxdepth 3 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier la migration creee :

```sh
find backend/apps/inventory/migrations -maxdepth 1 -type f | sort
sed -n '1,220p' backend/apps/inventory/migrations/0002_inventoryavailability.py
```

Verifier qu'aucune migration supplementaire n'est necessaire apres creation de `0002_inventoryavailability.py` :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_inventory_availability_model.py tests/backend/test_inventory_availability_persistence.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Appliquer les migrations dans Docker Compose pour valider PostgreSQL local :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python backend/manage.py showmigrations inventory &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F29 ne cree aucun serializer, view, URL, endpoint API, endpoint d'ecriture inventory, viewset, router, admin, JWT/token, role metier, groupe metier ou permission custom. F29 ne cree pas de module complet de reservation, contrat, facture, paiement, client, planning ou frontend.

## Helpers disponibilite inventory

F30 ajoute des helpers internes pour detecter les conflits de disponibilite d'un `InventoryItem`.

Verifier la structure des fichiers :

```sh
find backend/apps/inventory -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est necessaire :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_inventory_availability_queries.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F30 ne cree aucune migration, aucun modele, serializer, view, URL, endpoint API, endpoint d'ecriture inventory, viewset, router, admin, JWT/token, role metier, groupe metier ou permission custom. F30 ne cree pas de module complet de reservation, contrat, facture, paiement, client, planning ou frontend.

## Smoke test seed demo inventory + disponibilite

F31 ajoute un smoke test interne qui valide les donnees `seed_demo_inventory` avec `InventoryAvailability` et les helpers de disponibilite F30.

Verifier la structure des tests :

```sh
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucune migration nouvelle n'est necessaire :

```sh
find backend/apps/inventory/migrations -maxdepth 1 -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_inventory_availability_seed_smoke.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations inventory --check --dry-run &&
    python backend/manage.py migrate --noinput &&
    python -m pytest tests/backend/test_inventory_availability_seed_smoke.py &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F31 ne cree aucune migration, aucun modele, serializer, view, URL, endpoint API, endpoint d'ecriture inventory, viewset, router, admin, JWT/token, role metier, groupe metier ou permission custom. F31 ne cree pas de module complet de reservation, contrat, facture, paiement, client, planning ou frontend.

## Decision domaine disponibilite inventory

F32 ajoute le document de decision `docs/decisions/DEC-002-inventory-availability-domain.md`.

Verifier le document de decision :

```sh
sed -n '1,220p' docs/decisions/DEC-002-inventory-availability-domain.md
```

Verifier qu'aucune migration nouvelle n'est creee :

```sh
find backend/apps/inventory/migrations -maxdepth 1 -type f | sort
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations inventory --check --dry-run
```

Verifier qu'aucun fichier API inventory n'a ete modifie :

```sh
git diff --name-only -- backend/apps/inventory/serializers.py backend/apps/inventory/views.py backend/apps/inventory/urls.py
```

Executer les controles applicables :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F32 ne modifie aucun code applicatif. F32 ne cree aucune migration, aucun modele, serializer, view, URL, endpoint API, endpoint d'ecriture inventory, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, test, module complet de reservation, contrat, facture, paiement, client, planning ou frontend.

## Squelette domaine reservations

F33 ajoute le squelette du domaine `reservations` et active l'app Django `apps.reservations`.

Verifier la structure du package :

```sh
find backend/apps/reservations -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier l'activation dans les settings :

```sh
grep -Rni "apps.reservations.apps.ReservationsConfig" backend/config/settings.py
```

Verifier qu'aucune migration n'est necessaire :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations reservations --check --dry-run
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_app_config.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer Django check dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python backend/manage.py makemigrations reservations --check --dry-run &&
    python backend/manage.py makemigrations --check --dry-run &&
    python backend/manage.py check &&
    python -m pytest tests/backend/test_reservations_app_config.py &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F33 ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, fixture, commande management, service metier complet, module complet de reservation, contrat, facture, paiement, client ou frontend.

## Garde-fou scope reservations

F34 ajoute un garde-fou pur Python dans `backend/apps/reservations/scope.py`.

Verifier la structure du package :

```sh
find backend/apps/reservations -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucun fichier applicatif interdit n'a ete cree dans `reservations` :

```sh
find backend/apps/reservations \
  \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -path "*/migrations/*" \
     -o -path "*/management/*" \) \
  -type f -print | sort
```

Verifier qu'aucune migration n'est necessaire :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations reservations --check --dry-run
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_scope.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_app_config.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer Django check et pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations reservations --check --dry-run &&
    python backend/manage.py makemigrations --check --dry-run &&
    python backend/manage.py check &&
    python -m pytest tests/backend/test_reservations_scope.py &&
    python -m pytest tests/backend/test_reservations_app_config.py &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F34 ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, fixture, commande management, service metier complet, module complet de reservation, contrat, facture, paiement, client ou frontend.

## Validation periodes reservations

F35 ajoute `backend/apps/reservations/periods.py` comme value object et helpers purs Python pour valider les futures periodes de reservation.

Verifier la structure du package :

```sh
find backend/apps/reservations -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucun fichier applicatif interdit n'a ete cree dans `reservations` :

```sh
find backend/apps/reservations \
  \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -path "*/migrations/*" \
     -o -path "*/management/*" \) \
  -type f -print | sort
```

Verifier qu'aucune migration n'est necessaire :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations reservations --check --dry-run
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_periods.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_scope.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_app_config.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer Django check et pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations reservations --check --dry-run &&
    python backend/manage.py makemigrations --check --dry-run &&
    python backend/manage.py check &&
    python -m pytest tests/backend/test_reservations_periods.py &&
    python -m pytest tests/backend/test_reservations_scope.py &&
    python -m pytest tests/backend/test_reservations_app_config.py &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F35 ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, fixture, commande management, service metier complet, module complet de reservation, contrat, facture, paiement, client ou frontend.

## Validation item + periode reservations

F36 ajoute `backend/apps/reservations/validation.py` comme helper pur Python pour valider une future demande de reservation item + periode.

Verifier la structure du package :

```sh
find backend/apps/reservations -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucun fichier applicatif interdit n'a ete cree dans `reservations` :

```sh
find backend/apps/reservations \
  \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -path "*/migrations/*" \
     -o -path "*/management/*" \) \
  -type f -print | sort
```

Verifier qu'aucune migration n'est necessaire :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations reservations --check --dry-run
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_validation.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_periods.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_scope.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_app_config.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer Django check et pytest dans un conteneur backend temporaire :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations reservations --check --dry-run &&
    python backend/manage.py makemigrations --check --dry-run &&
    python backend/manage.py check &&
    python -m pytest tests/backend/test_reservations_validation.py &&
    python -m pytest tests/backend/test_reservations_periods.py &&
    python -m pytest tests/backend/test_reservations_scope.py &&
    python -m pytest tests/backend/test_reservations_app_config.py &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F36 ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, fixture, commande management, service metier complet, module complet de reservation, contrat, facture, paiement, client ou frontend.

## Validation disponibilite reservations

F37 ajoute `backend/apps/reservations/availability.py` comme helper backend interne pour valider une future demande de reservation item + periode et lire les conflits `InventoryAvailability` existants.

Verifier la structure du package :

```sh
find backend/apps/reservations -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucun fichier applicatif interdit n'a ete cree dans `reservations` :

```sh
find backend/apps/reservations \
  \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -path "*/migrations/*" \
     -o -path "*/management/*" \) \
  -type f -print | sort
```

Verifier qu'aucune migration n'est necessaire :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations reservations --check --dry-run
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_availability.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_validation.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_periods.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_scope.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_inventory_availability_queries.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer Django check et pytest dans un conteneur backend temporaire si la DB locale hors Docker ne resout pas le host Compose :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations reservations --check --dry-run &&
    python backend/manage.py makemigrations --check --dry-run &&
    python backend/manage.py check &&
    python -m pytest tests/backend/test_reservations_availability.py &&
    python -m pytest tests/backend/test_reservations_validation.py &&
    python -m pytest tests/backend/test_reservations_periods.py &&
    python -m pytest tests/backend/test_reservations_scope.py &&
    python -m pytest tests/backend/test_inventory_availability_queries.py &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness si le backend est demarre :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F37 ne cree aucune reservation persistante, n'ecrit jamais en DB et ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, fixture, commande management, service metier complet, module complet de reservation, contrat, facture, paiement, client ou frontend.

## Preview reservation item

F38 ajoute `backend/apps/reservations/preview.py` comme value object interne de preview d'une future demande de reservation item.

Verifier la structure du package :

```sh
find backend/apps/reservations -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Verifier qu'aucun fichier applicatif interdit n'a ete cree dans `reservations` :

```sh
find backend/apps/reservations \
  \( -path "backend/apps/reservations/preview.py" \) -prune \
  -o \( -name "models.py" \
     -o -name "serializers.py" \
     -o -name "views.py" \
     -o -name "viewsets.py" \
     -o -name "urls.py" \
     -o -name "admin.py" \
     -o -path "*/migrations/*" \
     -o -path "*/management/*" \) \
  -type f -print | sort
```

Verifier qu'aucune migration n'est necessaire :

```sh
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations reservations --check --dry-run
set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations --check --dry-run
```

Executer les controles locaux :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_preview.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_availability.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_validation.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_periods.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_reservations_scope.py
set -a && source .env && set +a && .venv/bin/python -m pytest tests/backend/test_inventory_availability_queries.py
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Executer Django check et pytest dans un conteneur backend temporaire si la DB locale hors Docker ne resout pas le host Compose :

```sh
docker compose --env-file .env up -d db
docker compose --env-file .env run --rm \
  -v "$PWD:/app" \
  backend \
  sh -lc '
    python -m pip install --no-cache-dir pytest pytest-django &&
    python backend/manage.py makemigrations reservations --check --dry-run &&
    python backend/manage.py makemigrations --check --dry-run &&
    python backend/manage.py check &&
    python -m pytest tests/backend/test_reservations_preview.py &&
    python -m pytest tests/backend/test_reservations_availability.py &&
    python -m pytest tests/backend/test_reservations_validation.py &&
    python -m pytest tests/backend/test_reservations_periods.py &&
    python -m pytest tests/backend/test_reservations_scope.py &&
    python -m pytest tests/backend/test_inventory_availability_queries.py &&
    python -m pytest
  '
```

Relancer le backend et verifier readiness si le backend est demarre :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend --force-recreate
curl -i http://127.0.0.1:8000/readyz/
docker compose --env-file .env down
```

F38 ne cree aucune reservation persistante, n'ecrit jamais en DB, ne fait aucun calcul commercial et ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, fixture, commande management, service metier complet, module complet de reservation, contrat, facture, paiement, client ou frontend.

## Service preview reservation item

F40 ajoute `backend/apps/reservations/services.py` comme couche service interne au-dessus de la preview F38.

Verifier la structure du package :

```sh
find backend/apps/reservations -maxdepth 2 -type f | sort
find tests/backend -maxdepth 1 -type f | sort
```

Executer les validations Docker standardisees depuis F39 :

```sh
docker compose --env-file .env build backend
docker compose --env-file .env up -d db backend
docker compose --env-file .env exec backend python -m pytest tests/backend/test_reservations_preview.py -q
docker compose --env-file .env exec backend python -m pytest tests/backend/test_reservations_preview_service.py -q
docker compose --env-file .env exec backend python -m pytest tests/backend -q
```

F40 ne cree aucune reservation persistante, n'ecrit jamais en DB et ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, fixture, commande management, service metier complet, module complet de reservation, contrat, facture, paiement, client ou frontend.

## Workflow prompts Codex

OP1 ajoute une couche documentaire pour reduire les prompts repetitifs Codex tout en conservant les validations strictes.

Le workflow recommande pour les taches sensibles ou explicitement soumises a approbation est en deux temps :

1. `PLAN ONLY` : lire les fichiers necessaires, analyser la tache, proposer un plan court, lister les fichiers a creer ou modifier, lister les validations prevues, ne modifier aucun fichier.
2. `IMPLEMENT APPROVED PLAN` : appliquer uniquement le plan approuve, modifier uniquement les fichiers approuves, executer uniquement les validations approuvees ou pertinentes, produire un rapport final.

Aucun des deux modes ne doit executer `git add`, `git commit` ou `git push` sauf demande explicite.

Verifier les fichiers Codex crees :

```sh
find docs/codex -maxdepth 1 -type f | sort
```

Verifier l'etat Git et le diff documentaire :

```sh
git branch --show-current
git status --short
git diff --name-status
git diff --stat
```

Verifier que les fichiers applicatifs et decisions protegees ne sont pas modifies :

```sh
git diff --name-only -- backend/apps backend/config compose.yaml pyproject.toml .env .env.example docs/decisions/DEC-001-titan-scope-validated.md docs/decisions/DEC-002-inventory-availability-domain.md
```

Verifier que `.env` n'est ni tracke ni stage :

```sh
git status --short -- .env
git ls-files .env
```

OP1 est documentaire. Aucun test lourd n'est requis sauf si un formatteur Markdown est ajoute au projet.

OP1 ne cree aucun modele, migration, serializer, view, URL, endpoint API, endpoint d'ecriture, viewset, router, admin, JWT/token, role metier, groupe metier, permission custom, frontend ou code applicatif backend.

## Readiness PostgreSQL backend

F12 ajoute `GET /readyz/` comme readiness check PostgreSQL minimal.

`/healthz/` reste un liveness check sans acces base de donnees. `/readyz/` verifie uniquement PostgreSQL. Redis n'est pas encore couvert par `/readyz/`.

Demarrer PostgreSQL et le backend local :

```sh
docker compose --env-file .env up -d db backend
```

Verifier l'etat des services et attendre le backend `healthy` :

```sh
docker compose --env-file .env ps
```

Tester le readiness check PostgreSQL minimal :

```sh
curl -i http://127.0.0.1:8000/readyz/
```

Arreter les services Compose locaux :

```sh
docker compose --env-file .env down
```
