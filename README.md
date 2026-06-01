# Hahitantsoa / Titan ERP

Ce repository contient le futur ERP evenementiel pour les activites Hahitantsoa et Titan.

Statut actuel : **F10 backend Compose healthcheck minimal en cours**.

La Foundation documentaire est terminee. F4 PostgreSQL/Redis est termine et a ajoute l'infrastructure Docker Compose locale pour ces deux services.

F5 a initialise uniquement un backend Django minimal et verifiable avec Python 3.14 comme version locale de developpement Foundation.

F6 a ajoute la qualite backend minimale : Ruff, Ruff format, pytest, pytest-django et un test de demarrage Django Foundation.

F7 a durci minimalement la configuration Django Foundation : lecture centralisee des variables d'environnement, conversions booleennes strictes, listes CSV et premiers reglages de securite configurables par environnement.

F8 a ajoute un endpoint backend de sante minimal `GET /healthz/`. Ce liveness check retourne seulement `{"status": "ok"}` et ne teste pas PostgreSQL ou Redis.

F9 a ajoute un service backend Docker Compose local. Il utilise Django `runserver` uniquement pour le developpement et expose `http://127.0.0.1:8000/healthz/` apres demarrage.

F10 ajoute un healthcheck Docker Compose au service backend pour refleter la disponibilite reelle de `/healthz/`. Cela reste une configuration de developpement local. Le projet n'est pas production-ready. Les modules metier Hahitantsoa/Titan ne sont pas encore implementes. Il n'existe pas encore de frontend React, de CI executable, de migration metier ou d'endpoint API metier.

L'infrastructure locale PostgreSQL/Redis ne demarre aucun service applicatif et ne publie pas les ports PostgreSQL ou Redis sur l'hote.

Le runbook local est disponible dans [docs/runbooks/local-development.md](docs/runbooks/local-development.md).

## Commandes backend locales

```sh
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
set -a && source .env && set +a && .venv/bin/python backend/manage.py check
set -a && source .env && set +a && .venv/bin/python -m pytest
```

## Documents a lire en priorite

1. [AGENTS.md](AGENTS.md)
2. [PLANS.md](PLANS.md)
3. [docs/decisions/DEC-001-titan-scope-validated.md](docs/decisions/DEC-001-titan-scope-validated.md)
4. [docs/adr/ADR-006-titan-excludes-venues-and-services.md](docs/adr/ADR-006-titan-excludes-venues-and-services.md)
5. [docs/business-rules/scope.md](docs/business-rules/scope.md)
6. [docs/architecture/foundation-plan.md](docs/architecture/foundation-plan.md)
7. [docs/runbooks/local-development.md](docs/runbooks/local-development.md)

## Perimetre fonctionnel cible

Hahitantsoa couvre l'evenement complet et peut inclure local, materiels/articles, mobilier et services annexes eventuels.

Titan couvre uniquement la location pure de materiels/articles et de packs materiels. Titan exclut definitivement les locaux et les services annexes.

Les materiels sont partages entre Hahitantsoa et Titan : une reservation confirmee dans un volet rend le materiel indisponible dans l'autre.
