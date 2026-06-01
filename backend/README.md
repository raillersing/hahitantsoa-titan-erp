# Backend

Ce dossier contient le squelette Django minimal de la Foundation technique F5.

Il initialise uniquement le projet `config` pour poser le socle backend cible : Python 3.14 comme version locale de developpement Foundation, Django 5.2 LTS, Django REST Framework, drf-spectacular et PostgreSQL via variables d'environnement.

Aucun module metier Hahitantsoa/Titan n'est encore cree. Il n'y a pas encore d'application metier, de modele metier, de serializer, de viewset, d'endpoint API metier ni de migration metier.

## Verification locale prevue

Depuis la racine du repository :

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
```

Ne pas executer les migrations avant validation explicite d'une phase ulterieure.

## Qualite backend

Installer les dependances de developpement :

```sh
.venv/bin/python -m pip install -e ".[dev]"
```

Executer le format check Ruff, le lint Ruff et les tests Foundation :

```sh
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python -m pytest
```

Ces controles restent techniques. Aucun module metier Hahitantsoa/Titan n'est encore cree.

## Configuration environnement

La configuration Django lit les variables d'environnement via des helpers Python purs dans `backend/config/env.py`. Ces helpers centralisent les chaines, booleens stricts et listes separees par virgules.

Variables de securite configurables localement :

- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_SECURE_SSL_REDIRECT`
- `DJANGO_SESSION_COOKIE_SECURE`
- `DJANGO_CSRF_COOKIE_SECURE`

En developpement local, les options secure restent a `False` sauf test explicite. Les valeurs de production ne sont pas definies en F7.

## Health endpoint

`GET /healthz/` retourne :

```json
{"status": "ok"}
```

Cet endpoint est un liveness check minimal. Il ne consulte ni PostgreSQL ni Redis et ne doit pas etre considere comme un readiness check complet.

`GET /readyz/` retourne `200` lorsque PostgreSQL est accessible :

```json
{"status": "ready", "checks": {"database": "ok"}}
```

En cas d'indisponibilite PostgreSQL, il retourne `503` sans exposer l'erreur interne :

```json
{"status": "not_ready", "checks": {"database": "error"}}
```

`/readyz/` verifie seulement PostgreSQL. Redis n'est pas teste en F12. Aucune logique metier Hahitantsoa/Titan n'existe encore.

## Service Docker Compose backend

F9 ajoute un service `backend` Docker Compose pour le developpement local.

Le conteneur installe le projet depuis `pyproject.toml` et lance :

```sh
python backend/manage.py runserver 0.0.0.0:8000
```

`runserver` est strictement reserve au developpement local et ne doit pas etre utilise en production.

Apres demarrage du service Compose, le liveness check minimal est accessible sur :

```text
http://127.0.0.1:8000/healthz/
```

Ce service ne cree aucun module metier et ne lance aucune migration.

Le service Compose `backend` dispose d'un healthcheck interne base sur `/healthz/`. Il verifie la disponibilite HTTP du liveness check depuis le conteneur backend.

`runserver` reste strictement local et reserve au developpement.

## Migrations Django standards

Les migrations Django standards peuvent etre appliquees dans la base PostgreSQL locale pour initialiser les tables techniques des apps integrees :

- `admin`
- `auth`
- `contenttypes`
- `sessions`

Cette etape ne cree aucune app metier, aucun modele metier Hahitantsoa/Titan et aucune migration metier.

## Domain packages

`backend/apps/` prepare les futurs domaines applicatifs backend :

- `common`
- `identity`
- `inventory`
- `reservations`
- `billing`
- `logistics`
- `audit`

Ces dossiers sont des packages Python preparatoires. Ils ne sont pas encore ajoutes a `INSTALLED_APPS` et ne sont pas encore des applications Django actives.

F13 ne cree aucun modele, migration, serializer, viewset ou endpoint metier.

## Common Django app

`apps.common` est la premiere app Django activee dans `INSTALLED_APPS`.

Elle sert uniquement a valider le pattern `AppConfig` pour les futurs domaines techniques et transversaux. Elle ne contient aucun modele, aucune migration et aucun endpoint.

Les autres domaines restent des packages preparatoires non actives.
