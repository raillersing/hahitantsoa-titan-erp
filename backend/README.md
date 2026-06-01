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
