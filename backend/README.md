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

Elle sert de socle technique transversal pour les futurs domaines backend.

F15 y ajoute des modeles abstraits techniques :

- `UUIDModel`
- `TimestampedModel`
- `SoftDeleteModel`
- `AuditableModel`

Ces classes sont abstraites uniquement. Elles ne creent aucune table, aucun modele metier Hahitantsoa/Titan et aucune migration metier.

Les autres domaines restent des packages preparatoires non actives.

## Inventory Django app

`apps.inventory` est maintenant activee comme app Django pour preparer le futur domaine inventory.

Cette app ne contient aucun modele, aucune migration, aucun endpoint, aucun serializer et aucun viewset.

Le domaine `inventory` preparera plus tard les materiels, articles, packs materiels et le stock partage.

F17 ajoute un premier garde-fou pur Python du perimetre Titan dans `apps.inventory`.

Ce garde-fou formalise les types d'elements autorises pour Titan sans creer de table, de modele inventory, de migration, de serializer, de viewset ou d'endpoint.

F18 ajoute `InventoryItem`, premier modele concret minimal du domaine inventory.

Le modele reste limite a l'identification d'un element inventory et a son type autorise pour Titan. Aucun endpoint, serializer, viewset ou admin n'est cree.

F19 ajoute des tests de persistance DB pour `InventoryItem`.

Ces tests couvrent la persistance des valeurs autorisees, la validation applicative des valeurs interdites et la contrainte DB `inventory_item_kind_allowed_for_titan`. Aucun endpoint, serializer, viewset ou admin n'est cree.

F20 ajoute `InventoryItemSerializer`.

Ce serializer prepare la future couche API en exposant les champs techniques de `InventoryItem` et en validant `kind` avec le garde-fou Titan existant. Aucun endpoint, URL, viewset ou admin n'est cree.

F21 expose une API read-only minimale pour `InventoryItem` :

- `GET /api/v1/inventory/items/`
- `GET /api/v1/inventory/items/<uuid:pk>/`

Seuls les items actifs et non supprimes sont exposes. Les methodes POST, PUT, PATCH et DELETE ne sont pas autorisees. Aucun endpoint d'ecriture, viewset, router ou admin n'existe encore.

## OpenAPI

F22 expose un schema OpenAPI minimal avec drf-spectacular :

- `GET /api/schema/`
- `GET /api/docs/swagger/`
- `GET /api/docs/redoc/`

Swagger UI et ReDoc servent uniquement a explorer la documentation API en local/dev.

L'API inventory reste read-only. Aucun endpoint d'ecriture, viewset, router ou admin n'existe encore.

## Authentification API inventory

F23 protege l'API inventory read-only avec la permission DRF standard `IsAuthenticated`.

Endpoints proteges :

- `GET /api/v1/inventory/items/`
- `GET /api/v1/inventory/items/<uuid:pk>/`

Endpoints publics conserves :

- `GET /healthz/`
- `GET /readyz/`
- `GET /api/schema/`
- `GET /api/docs/swagger/`
- `GET /api/docs/redoc/`

Aucun role metier avance, permission custom, endpoint d'ecriture, viewset, router ou admin n'est encore implemente.
