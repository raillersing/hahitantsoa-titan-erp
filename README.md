# Hahitantsoa / Titan ERP

Ce repository contient le futur ERP evenementiel pour les activites Hahitantsoa et Titan.

Statut actuel : **F26 seed local de donnees InventoryItem de demonstration en cours**.

La Foundation documentaire est terminee. F4 PostgreSQL/Redis est termine et a ajoute l'infrastructure Docker Compose locale pour ces deux services.

F5 a initialise uniquement un backend Django minimal et verifiable avec Python 3.14 comme version locale de developpement Foundation.

F6 a ajoute la qualite backend minimale : Ruff, Ruff format, pytest, pytest-django et un test de demarrage Django Foundation.

F7 a durci minimalement la configuration Django Foundation : lecture centralisee des variables d'environnement, conversions booleennes strictes, listes CSV et premiers reglages de securite configurables par environnement.

F8 a ajoute un endpoint backend de sante minimal `GET /healthz/`. Ce liveness check retourne seulement `{"status": "ok"}` et ne teste pas PostgreSQL ou Redis.

F9 a ajoute un service backend Docker Compose local. Il utilise Django `runserver` uniquement pour le developpement et expose `http://127.0.0.1:8000/healthz/` apres demarrage.

F10 a ajoute un healthcheck Docker Compose au service backend pour refleter la disponibilite reelle de `/healthz/`.

F11 a valide l'application controlee des migrations Django standards en base PostgreSQL locale. Cela concerne uniquement les apps integrees `admin`, `auth`, `contenttypes` et `sessions`; ce ne sont pas des migrations metier.

F12 a ajoute un readiness endpoint PostgreSQL minimal `GET /readyz/`. `/healthz/` reste un liveness check sans acces base de donnees, tandis que `/readyz/` verifie uniquement l'acces PostgreSQL avec une requete minimale. Redis n'est pas encore teste.

F13 a ajoute une structure de packages de domaines backend sous `backend/apps/`.

F14 a active uniquement l'app Django technique `apps.common`. Les autres domaines restent des packages preparatoires non actives dans `INSTALLED_APPS`.

F15 a ajoute des modeles abstraits techniques dans `apps.common` pour preparer les futurs modeles backend. Ces modeles sont abstraits uniquement : ils ne creent aucune table, aucune migration metier et aucun modele metier Hahitantsoa/Titan.

F16 a active uniquement l'app Django `apps.inventory` pour valider le pattern AppConfig du futur domaine inventory. `inventory` ne contient encore aucun modele metier, aucune migration, aucun endpoint API metier, aucun serializer et aucun viewset.

F17 a ajoute un garde-fou pur Python dans `apps.inventory` pour formaliser les types d'elements autorises pour Titan.

F18 a ajoute le premier modele concret minimal `InventoryItem` et une migration initiale inventory controlee. `InventoryItem.kind` reste limite aux valeurs autorisees pour Titan : `material`, `article` et `material_pack`. Aucun endpoint API, serializer, view, viewset ou admin n'est cree.

F19 a ajoute des tests DB pour `InventoryItem`. Ces tests valident la persistance des valeurs autorisees, le rejet applicatif des valeurs interdites et la contrainte DB. Aucune migration nouvelle et aucun endpoint API ne sont crees.

F20 a ajoute un serializer DRF minimal pour `InventoryItem`. Il prepare la validation de la future couche API sans creer d'endpoint, d'URL, de view, de viewset, d'admin ou de migration.

F21 a ajoute une API read-only minimale pour `InventoryItem`. Elle expose uniquement la liste et le detail des items actifs et non supprimes. Aucune ecriture API n'est autorisee et aucune migration n'est creee.

F22 a ajoute une documentation OpenAPI minimale avec drf-spectacular pour usage local/dev :

- `/api/schema/`
- `/api/docs/swagger/`
- `/api/docs/redoc/`

F22 ne cree aucune migration et aucun endpoint d'ecriture.

F23 a protege l'API inventory read-only par authentification DRF standard. Les endpoints inventory exigent un utilisateur authentifie.

Les endpoints suivants restent publics :

- `/healthz/`
- `/readyz/`
- `/api/schema/`
- `/api/docs/swagger/`
- `/api/docs/redoc/`

F23 ne cree aucune migration et aucun endpoint d'ecriture.

F24 a ajoute les routes DRF session login/logout pour usage dev/local avec la Browsable API :

- `/api-auth/login/`
- `/api-auth/logout/`

L'API inventory reste protegee. Aucun JWT, token auth, role metier, migration ou endpoint d'ecriture n'est cree.

F25 a ajoute une commande locale de seed d'utilisateur de developpement :

```sh
python backend/manage.py seed_dev_user
```

Elle lit `DJANGO_DEV_USERNAME`, `DJANGO_DEV_PASSWORD` et `DJANGO_DEV_EMAIL` depuis l'environnement charge par Django. `DJANGO_DEV_EMAIL` est optionnel. Le mot de passe ne doit jamais etre commite, et la commande ne l'affiche jamais.

Cette commande est destinee au local/dev uniquement. Elle refuse de s'executer lorsque `DEBUG=False`, cree ou met a jour un utilisateur standard non staff et non superuser, et permet de tester `/api-auth/login/` en session locale. F25 ne cree aucune migration, aucun modele, aucun endpoint, aucun JWT/token et aucun role metier.

F26 ajoute une commande locale de seed de donnees `InventoryItem` de demonstration :

```sh
python backend/manage.py seed_demo_inventory
```

Cette commande est destinee au local/dev uniquement et refuse `DEBUG=False`. Elle cree uniquement des donnees conformes Titan avec les kinds `material`, `article` et `material_pack`.

Elle ne cree jamais de local, salle, lieu, service annexe ou service evenementiel. F26 ne cree aucune migration, aucun modele, serializer, view, endpoint, JWT/token ou role metier.

Le projet n'est pas production-ready. Aucun modele metier Hahitantsoa/Titan n'existe encore. Il n'existe pas encore de frontend React, de CI executable, de migration metier ou d'endpoint API metier.

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
