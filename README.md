# Hahitantsoa / Titan ERP

Ce repository contient le futur ERP evenementiel pour les activites Hahitantsoa et Titan.

Statut actuel : **F40 couche service preview reservation en cours**.

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

F26 a ajoute une commande locale de seed de donnees `InventoryItem` de demonstration :

```sh
python backend/manage.py seed_demo_inventory
```

Cette commande est destinee au local/dev uniquement et refuse `DEBUG=False`. Elle cree uniquement des donnees conformes Titan avec les kinds `material`, `article` et `material_pack`.

Elle ne cree jamais de local, salle, lieu, service annexe ou service evenementiel. F26 ne cree aucune migration, aucun modele, serializer, view, endpoint, JWT/token ou role metier.

F27 a ajoute un smoke test authentifie du parcours inventory. Le test couvre le seed d'un utilisateur dev, le seed des donnees demo inventory, le login session Django/DRF, `GET /api/v1/inventory/items/` authentifie et la validation des kinds Titan autorises.

Le smoke test attend uniquement `material`, `article` et `material_pack`, et verifie l'absence de `venue`, `local`, `room`, `service` et `event_service`.

F28 a ajoute un smoke test du detail inventory authentifie et confirme que l'API inventory reste read-only. Le test couvre le seed dev user, le seed demo inventory, le login session, `GET /api/v1/inventory/items/`, `GET /api/v1/inventory/items/<id>/`, le refus de POST, PUT, PATCH et DELETE, et la validation des kinds Titan.

F29 a ajoute le socle de domaine `InventoryAvailability` pour representer de futures periodes d'indisponibilite ou de reservation d'un `InventoryItem`. Ce n'est pas encore un module complet de reservation, planning, contrat, facture, paiement ou client.

L'API inventory reste read-only et aucun endpoint d'ecriture n'est cree.

F30 a ajoute des helpers internes pour detecter les conflits de disponibilite inventory sur une periode donnee. Ces helpers utilisent les periodes `blocked` et `reserved` et traitent les intervalles comme `[start_at, end_at)`.

F30 ne cree aucune API, aucun serializer, aucune view, aucune URL, aucun endpoint d'ecriture et aucun module complet de reservation.

F31 a ajoute un smoke test interne qui valide que les donnees creees par `seed_demo_inventory` peuvent etre utilisees avec `InventoryAvailability` et les helpers internes de disponibilite.

F31 ne cree aucune API, aucun serializer, aucune view, aucune URL, aucun endpoint d'ecriture et aucun module complet de reservation. L'API inventory reste read-only.

F32 a ajoute un document de decision sur le domaine de disponibilite inventory : `docs/decisions/DEC-002-inventory-availability-domain.md`.

F32 ne modifie aucun code applicatif. Aucune migration, aucun modele, serializer, view, endpoint, test ou module complet de reservation n'est cree. L'API inventory reste read-only.

F33 a ajoute le squelette du domaine `reservations` et installe l'app Django `apps.reservations`.

F33 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F34 a ajoute un garde-fou pur Python dans `apps.reservations` pour formaliser les kinds `InventoryItem` reservables par les futures reservations Titan.

Seuls les kinds suivants sont reservables :

- `material`
- `article`
- `material_pack`

Les kinds `venue`, `local`, `room`, `service`, `event_service` et les kinds inconnus sont refuses.

F34 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F35 a ajoute un value object immuable et des helpers purs Python pour valider les futures periodes de reservation dans `apps.reservations`.

Les bornes `start_at` et `end_at` sont obligatoires, doivent etre des datetimes timezone-aware, et `end_at` doit etre strictement superieur a `start_at`.

Les periodes sont interpretees comme des intervalles demi-ouverts `[start_at, end_at)`, alignes avec `DEC-002-inventory-availability-domain.md`.

F35 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F36 a ajoute un helper pur Python de validation d'une future demande de reservation item + periode.

Cette validation combine le kind reservable via `assert_reservable_inventory_item_kind` et la periode valide via `make_reservation_period`.

F36 ne cree aucune reservation persistante, aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

OP1 ajoute une couche documentaire d'optimisation des prompts Codex pour reduire les prompts repetitifs tout en conservant les garde-fous senior :

- `docs/codex/task-prompt-template.md` ;
- `docs/codex/reasoning-policy.md` ;
- `docs/codex/validation-checklist.md`.

Le workflow OP1 standardise les prompts courts par tache Fxx, le choix du niveau de reasoning et les validations de fin de tache. Il ne modifie aucun code applicatif backend, ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend, et ne change pas les decisions Titan.

OP1-b formalise le workflow Codex en deux temps :

1. `PLAN ONLY` : lire, analyser, proposer le plan, lister les fichiers et validations, sans modifier de fichier.
2. `IMPLEMENT APPROVED PLAN` : appliquer uniquement le plan approuve, executer les validations pertinentes et produire le rapport final.

Ce workflow vise les taches sensibles, structurantes ou explicitement soumises a approbation.

F37 ajoute un helper backend interne de validation de disponibilite pour une future demande de reservation item + periode.

Ce helper combine :

- la validation F36 du kind reservable et de la periode ;
- les helpers internes F30 `InventoryAvailability` pour lire les conflits existants.

F37 lit la DB uniquement pour verifier les conflits de disponibilite, ne cree aucune reservation persistante, n'ecrit jamais en DB et laisse `inventory_unit_count` a `None` tant qu'aucun champ quantite/unite/stock n'est valide sur `InventoryItem`.

F37 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F38 ajoute un value object interne de preview d'une future demande de reservation item.

Cette preview compose le helper F37 `validate_reservation_item_availability_request` et expose un statut interne :

- `invalid` ;
- `unavailable` ;
- `available`.

F38 ne fait aucun calcul commercial, ne cree aucun devis, n'ecrit jamais en DB et ne cree aucune reservation persistante. F38 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F39 standardise l'image Docker backend locale pour les tests backend reproductibles.

L'image backend installe maintenant les dependances de developpement Python declarees dans `pyproject.toml` et embarque le dossier `tests/`. Apres build et demarrage Compose, les tests backend peuvent etre lances sans `pip install` manuel et sans `docker compose cp` :

```sh
docker compose exec backend python -m pytest tests/backend -q
```

Le backend continue de demarrer avec Django `runserver` via `docker compose up -d`. F39 ne modifie aucune logique metier, aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend.

F40 ajoute une couche service interne de preview de reservation item.

Le service `preview_reservation_item_service` orchestre la preview F38 sans dupliquer la logique, sans double lecture DB et sans ecriture DB. Il ne cree aucune reservation persistante et ne cree aucun endpoint API.

F40 ne modifie aucune logique metier inventory, availability ou preview. F40 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, frontend, contrat, facture, paiement, client ou workflow commercial complet.

Le projet n'est pas production-ready. Les modeles inventory existants restent des socles minimaux. Il n'existe pas encore de frontend React, de CI executable, de module complet de reservation/location ou d'endpoint API metier d'ecriture.

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
4. [docs/decisions/DEC-002-inventory-availability-domain.md](docs/decisions/DEC-002-inventory-availability-domain.md)
5. [docs/adr/ADR-006-titan-excludes-venues-and-services.md](docs/adr/ADR-006-titan-excludes-venues-and-services.md)
6. [docs/business-rules/scope.md](docs/business-rules/scope.md)
7. [docs/architecture/foundation-plan.md](docs/architecture/foundation-plan.md)
8. [docs/runbooks/local-development.md](docs/runbooks/local-development.md)

## Workflow Codex

Les prompts courts Codex sont documentes dans `docs/codex/`.

- Utiliser `docs/codex/task-prompt-template.md` pour cadrer les futures taches Fxx.
- Utiliser `docs/codex/reasoning-policy.md` pour choisir Low, Medium ou High selon le risque.
- Utiliser `docs/codex/validation-checklist.md` pour preparer le rapport final et les validations.
- Utiliser `PLAN ONLY` puis `IMPLEMENT APPROVED PLAN` pour les taches sensibles ou explicitement soumises a approbation.

Ces documents ne remplacent pas les sources de verite. `AGENTS.md`, `DEC-001` et `DEC-002` restent prioritaires.

## Perimetre fonctionnel cible

Hahitantsoa couvre l'evenement complet et peut inclure local, materiels/articles, mobilier et services annexes eventuels.

Titan couvre uniquement la location pure de materiels/articles et de packs materiels. Titan exclut definitivement les locaux et les services annexes.

Les materiels sont partages entre Hahitantsoa et Titan : une reservation confirmee dans un volet rend le materiel indisponible dans l'autre.
