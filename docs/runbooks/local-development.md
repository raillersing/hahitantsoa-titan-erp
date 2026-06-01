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
