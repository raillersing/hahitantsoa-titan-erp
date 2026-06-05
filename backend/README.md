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

`GET /readyz/` retourne `200` lorsque PostgreSQL et Redis sont accessibles :

```json
{"status": "ready", "checks": {"database": "ok", "redis": "ok"}}
```

En cas d'indisponibilite PostgreSQL ou Redis, il retourne `503` sans exposer l'erreur interne :

```json
{"status": "not_ready", "checks": {"database": "error", "redis": "ok"}}
```

Le check Redis F41 utilise une verification minimale via la stdlib Python et ne depend pas d'un client Python Redis. Aucune logique metier Hahitantsoa/Titan n'est executee par `/readyz/`.

La matrice de sante Foundation detaillee est documentee dans [docs/runbooks/health-readiness-matrix.md](../docs/runbooks/health-readiness-matrix.md).

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

L'image backend locale installe aussi les dependances de developpement Python declarees dans `pyproject.toml` et embarque le dossier `tests/`.

Apres build et demarrage de `db` + `redis` + `backend`, la commande officielle de test backend Docker est :

```sh
docker compose exec backend python -m pytest tests/backend -q
```

Cette commande ne necessite ni installation `pip` manuelle dans un conteneur deja demarre, ni copie manuelle de `tests/` avec `docker compose cp`.

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

## Session DRF dev/local

F24 ajoute les routes DRF de session pour la Browsable API :

- `GET /api-auth/login/`
- `POST /api-auth/logout/`

Ces routes servent aux tests manuels et au developpement local. Elles ne constituent pas une strategie finale d'authentification production.

L'API inventory reste protegee par authentification. Aucun JWT, token auth, role metier avance, endpoint d'ecriture, viewset, router ou admin n'est cree.

## Seed dev user local

F25 ajoute la commande technique locale :

```sh
python backend/manage.py seed_dev_user
```

Elle sert a creer ou mettre a jour un utilisateur standard local pour tester `/api-auth/login/` et la Browsable API.

Variables d'environnement lues par la commande :

- `DJANGO_DEV_USERNAME`
- `DJANGO_DEV_PASSWORD`
- `DJANGO_DEV_EMAIL` optionnel

La commande utilise uniquement l'environnement deja charge par Django. Elle ne lit pas `.env` directement et ne doit jamais afficher le mot de passe.

Lorsque `DEBUG=False`, la commande refuse de creer ou mettre a jour l'utilisateur. Elle force un utilisateur standard actif, non staff et non superuser. Elle ne cree aucun role metier, groupe, permission custom, JWT, token auth, endpoint ou migration.

## Seed demo inventory local

F26 ajoute la commande technique locale :

```sh
python backend/manage.py seed_demo_inventory
```

Elle sert a creer ou mettre a jour un petit jeu de donnees `InventoryItem` pour tester manuellement l'API inventory read-only.

La commande refuse de s'executer lorsque `DEBUG=False`.

Elle cree uniquement des donnees conformes au perimetre Titan :

- `material`
- `article`
- `material_pack`

Elle ne cree aucun local, salle, lieu, service annexe ou service evenementiel. Elle ne cree aucun endpoint d'ecriture, aucun modele, serializer, view, viewset, router, admin, JWT/token, role metier ou migration.

## Smoke test inventory authentifie

F27 couvre ensemble les commandes locales `seed_dev_user` et `seed_demo_inventory` dans un smoke test authentifie.

Le test valide le parcours suivant :

- seed d'un utilisateur dev local ;
- seed des donnees demo `InventoryItem` ;
- login session Django/DRF ;
- `GET /api/v1/inventory/items/` avec utilisateur authentifie ;
- presence des kinds Titan autorises ;
- absence des kinds interdits.

Ce test ne cree aucun endpoint d'ecriture, modele, serializer, view, viewset, router, admin, JWT/token, role metier ou migration.

F28 complete ce parcours avec un smoke test authentifie du detail inventory read-only.

Le test valide aussi :

- `GET /api/v1/inventory/items/<uuid:pk>/` avec utilisateur authentifie ;
- la coherence du detail retourne avec l'item issu de la liste ;
- le refus de POST, PUT, PATCH et DELETE sur l'API inventory.

L'API inventory reste read-only. F28 ne cree aucun modele, serializer, view, endpoint, viewset, router, admin, JWT/token, role metier ou migration.

## Inventory availability groundwork

F29 ajoute `InventoryAvailability` comme socle minimal pour representer une periode pendant laquelle un `InventoryItem` est indisponible ou reserve pour un usage futur.

Champs principaux :

- `inventory_item` ;
- `status` ;
- `start_at` ;
- `end_at` ;
- `notes`.

Les statuts initiaux sont :

- `blocked` ;
- `reserved`.

La base protege les periodes avec une contrainte `end_at > start_at` et limite les statuts aux valeurs autorisees.

Ce socle ne cree pas encore de module complet de reservation, location, planning, contrat, facture, paiement ou client. L'API inventory reste read-only : aucun serializer, view, URL, endpoint d'ecriture, viewset, router ou admin n'est ajoute en F29.

## Inventory availability helpers

F30 ajoute le module interne `backend/apps/inventory/availability.py`.

Il fournit des helpers metier pour detecter les conflits de disponibilite d'un `InventoryItem` sur une periode donnee :

- `get_inventory_availability_conflicts` ;
- `is_inventory_item_available`.

Les conflits sont calcules avec des intervalles demi-ouverts `[start_at, end_at)`. Une periode existante entre en conflit lorsque `existing.start_at < requested_end_at` et `existing.end_at > requested_start_at`.

Les statuts `blocked` et `reserved` rendent l'item indisponible. F30 ne cree aucune API, aucun serializer, view, URL, endpoint d'ecriture, viewset, router, admin, module complet de reservation, contrat, facture, paiement ou client.

F50 ajoute le selector interne `get_available_inventory_items_for_period`.

Ce selector retourne les `InventoryItem` actifs, non supprimes, conformes Titan et disponibles sur une periode `[start_at, end_at)`.

Il exclut les items ayant un conflit `InventoryAvailability` avec un statut `blocked` ou `reserved`. Il reste une lecture backend interne : aucune API, serializer, view, URL, endpoint d'ecriture, admin, frontend, modele, migration, logique de stock, quantite ou ecriture DB n'est ajoutee.

## Reservations available items selector

F51 ajoute `backend/apps/reservations/selectors.py`.

Le selector `get_available_reservation_inventory_items_for_period` valide la periode avec les regles reservations, puis delegue au selector inventory F50 pour retourner les `InventoryItem` disponibles.

Il ne duplique pas la logique d'overlap `InventoryAvailability`, reste read-only et ne cree aucune reservation persistante, API, serializer, view, URL, admin, frontend, modele, migration, contrat, facture, paiement, client, stock ou quantite.

## Reservations available items options service

F52 ajoute un service interne dans `backend/apps/reservations/services.py`.

Le service `get_reservation_available_items_options_service` valide la periode reservations, delegue au selector F51 et retourne une structure `ReservationAvailableItemsOptions` contenant la periode, les items disponibles materialises en tuple et leur compteur.

La logique d'overlap reste centralisee dans inventory/F50. F52 reste read-only et ne cree aucune reservation persistante, API, serializer, view, URL, admin, frontend, modele, migration, contrat, facture, paiement, client, stock, quantite, unite ou pricing.

## Reservations service consistency

F53 ajoute un test de coherence transversal entre le service de preview F40 et le service d'options d'items disponibles F52.

Ce test verifie que les deux chemins internes restent alignes sur les memes regles Titan de disponibilite pour les items disponibles, indisponibles et les kinds interdits. F53 ne modifie pas la logique metier et ne cree aucune reservation persistante, API, serializer, view, URL, admin, frontend, modele ou migration.

## Inventory availability seed smoke

F31 ajoute un smoke test interne qui combine les donnees locales creees par `seed_demo_inventory` avec `InventoryAvailability` et les helpers de disponibilite.

Le test valide que les items demo conformes Titan peuvent etre controles par `get_inventory_availability_conflicts` et `is_inventory_item_available`, sans passer par l'API HTTP et sans creer d'utilisateur ou de logique d'authentification.

Ce controle reste interne au backend. L'API inventory reste read-only et aucun serializer, view, URL, endpoint d'ecriture, viewset, router, admin, module complet de reservation, contrat, facture, paiement ou client n'est ajoute.

## Inventory availability decision

F32 formalise les regles de disponibilite inventory dans [DEC-002-inventory-availability-domain.md](../docs/decisions/DEC-002-inventory-availability-domain.md).

Cette decision consolide `InventoryAvailability`, les statuts `blocked` et `reserved`, la contrainte `end_at > start_at`, les intervalles `[start_at, end_at)` et les helpers internes de disponibilite.

Le document confirme aussi que l'API inventory reste read-only et que les helpers restent internes au backend.

## Reservations Django app

F33 ajoute le package `backend/apps/reservations` et active l'app Django `apps.reservations`.

Ce package est uniquement le squelette du futur domaine reservation/location. Il devra s'appuyer plus tard sur les regles de disponibilite documentees dans `DEC-002-inventory-availability-domain.md`.

Aucun modele metier n'est encore cree dans `reservations`. F33 ne cree aucune migration, serializer, view, URL, endpoint d'ecriture, admin, service metier complet, contrat, facture, paiement, client ou frontend.

F34 ajoute `backend/apps/reservations/scope.py`.

Ce garde-fou pur Python formalise les kinds `InventoryItem` reservables par les futures reservations Titan, sans acces DB :

- `material`
- `article`
- `material_pack`

Les kinds `venue`, `local`, `room`, `service`, `event_service` et les kinds inconnus ne sont pas reservables.

Le module `reservations` n'a toujours pas de modele metier, migration, serializer, view, URL, endpoint, admin ou service metier complet.

F36 ajoute `backend/apps/reservations/validation.py`.

Ce helper pur Python valide une future demande de reservation item + periode, sans acces DB.

Il combine :

- `assert_reservable_inventory_item_kind` pour verifier que le kind inventory est reservable dans Titan ;
- `make_reservation_period` pour valider `start_at`, `end_at`, `end_at > start_at` et l'intervalle `[start_at, end_at)`.

Le module `reservations` n'a toujours pas de modele metier, migration, serializer, view, URL, endpoint, admin ou service metier complet.

F37 ajoute `backend/apps/reservations/availability.py`.

Ce helper interne valide une future demande de reservation item + periode puis lit les conflits `InventoryAvailability` existants via les helpers inventory F30.

Il retourne une dataclass immuable avec :

- `valid` ;
- `available` ;
- `errors` ;
- `inventory_unit_count` ;
- `details`.

`inventory_unit_count` reste `None` en F37 car `InventoryItem` ne contient pas encore de champ quantite, unite ou stock valide.

F37 ne cree aucune reservation persistante, n'ecrit jamais en DB, ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, contrat, facture, paiement, client ou frontend.

F38 ajoute `backend/apps/reservations/preview.py`.

Ce module fournit un value object interne `ReservationItemPreview` pour preparer une future demande de reservation item sans creer de reservation persistante.

Le helper expose :

- `preview_reservation_item_request`.

La preview compose uniquement `validate_reservation_item_availability_request` et expose un statut interne :

- `invalid` ;
- `unavailable` ;
- `available`.

F38 ne fait aucun calcul commercial, n'ecrit jamais en DB, ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, contrat, facture, paiement, client ou frontend.

F40 ajoute `backend/apps/reservations/services.py`.

Ce module fournit une couche service interne mince pour orchestrer la preview de reservation item :

- `preview_reservation_item_service`.

Le service delegue a `preview_reservation_item_request` et ne duplique pas la logique F38. Il ne cree aucune reservation persistante, n'ecrit jamais en DB et ne cree aucun endpoint API.

F40 ne cree aucun modele, migration, serializer, view, URL, admin, contrat, facture, paiement, client ou frontend.

F35 ajoute `backend/apps/reservations/periods.py`.

Ce module fournit un value object immuable `ReservationPeriod` et des helpers purs Python pour valider les futures periodes de reservation, sans acces DB :

- `is_aware_datetime` ;
- `validate_reservation_period` ;
- `make_reservation_period`.

Les bornes `start_at` et `end_at` doivent etre des datetimes timezone-aware.

La periode est valide uniquement si `end_at > start_at`.

Les periodes sont interpretees comme des intervalles demi-ouverts `[start_at, end_at)`, en coherence avec les regles de disponibilite inventory.

Le module `reservations` n'a toujours pas de modele metier, migration, serializer, view, URL, endpoint, admin ou service metier complet.
