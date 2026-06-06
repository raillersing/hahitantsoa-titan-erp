# Inventory

Role prevu : accueillir les futurs materiels, articles, packs materiels et le stock partage.

F16 active `inventory` comme app Django technique via `InventoryConfig`.

Son role futur est de porter les materiels, articles, packs materiels et le stock partage.

F17 ajoute un garde-fou pur Python du perimetre Titan.

`InventoryItemKind` contient uniquement les valeurs autorisees pour Titan :

- `material`
- `article`
- `material_pack`

Regle Titan a conserver : Titan autorise uniquement materiels/articles et packs materiels. Titan ne doit jamais inclure local, salle, lieu, service annexe ou service evenementiel. Aucune configuration alternative, aucun feature flag, aucun champ et aucune permission ne doit permettre cela.

Titan ne doit jamais accepter :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

## Authentification

F23 protege les endpoints inventory read-only par la permission DRF standard `IsAuthenticated`.

Endpoints proteges :

- `GET /api/v1/inventory/items/`
- `GET /api/v1/inventory/items/<uuid:pk>/`

Seuls les items actifs et non supprimes sont exposes.

`kind` reste limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan ne doit jamais accepter :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F23 ne cree ni RBAC avance, ni permission custom, ni stock, ni reservation, ni facturation, ni endpoint d'ecriture.

Les tests et usages dev/local peuvent utiliser les routes de session DRF ajoutees en F24 :

- `/api-auth/login/`
- `/api-auth/logout/`

L'API inventory reste protegee par authentification. Seuls les items actifs et non supprimes sont exposes.

Titan autorise uniquement :

- `material` ;
- `article` ;
- `material_pack`.

Titan ne doit jamais accepter local, salle, lieu, service annexe ou service evenementiel.

Hors perimetre F17 : aucune logique de stock, reservation, facturation ou disponibilite n'est creee.

Aucun modele, migration, serializer, viewset, endpoint ou table n'est cree dans ce domaine en F17.

## InventoryItem

F18 ajoute `InventoryItem`, premier modele concret minimal du domaine inventory.

Champs principaux :

- `name` ;
- `kind` ;
- `description` ;
- `is_active`.

`kind` autorise uniquement :

- `material` ;
- `article` ;
- `material_pack`.

Titan ne doit jamais accepter :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F18 ne cree ni stock movement, ni disponibilite, ni reservation, ni facturation, ni logistique, ni endpoint API, ni serializer, ni viewset, ni admin.

## Validation DB

F19 ajoute des tests de persistance DB pour `InventoryItem`.

Les valeurs autorisees sont persistables :

- `material` ;
- `article` ;
- `material_pack`.

Les valeurs interdites sont rejetees par la validation applicative et par la contrainte DB `inventory_item_kind_allowed_for_titan`.

Titan reste limite a `material`, `article` et `material_pack`.

## InventoryItemSerializer

F20 ajoute `InventoryItemSerializer` pour preparer la future couche API sans exposer de route.

Champs exposes :

- `id` ;
- `name` ;
- `kind` ;
- `description` ;
- `is_active` ;
- `created_at` ;
- `updated_at` ;
- `is_deleted` ;
- `deleted_at` ;
- `created_by` ;
- `updated_by`.

`kind` reste limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan ne doit jamais accepter :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F20 ne cree ni endpoint, ni route, ni view, ni viewset, ni admin, ni migration.

## API read-only

F21 expose une API minimale en lecture seule :

- `GET /api/v1/inventory/items/`
- `GET /api/v1/inventory/items/<uuid:pk>/`

Seuls les items actifs et non supprimes sont exposes.

Les ecritures API ne sont pas autorisees : POST, PUT, PATCH et DELETE retournent `405`.

`kind` reste limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan ne doit jamais accepter :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F21 ne cree ni endpoint de stock, ni reservation, ni facturation, ni endpoint d'ecriture, ni viewset, ni router, ni admin.

## OpenAPI

F22 rend les endpoints inventory read-only visibles dans le schema OpenAPI :

- `GET /api/v1/inventory/items/`
- `GET /api/v1/inventory/items/<uuid:pk>/`

Seuls les items actifs et non supprimes sont exposes.

`kind` reste limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan ne doit jamais accepter :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

## Commande seed_demo_inventory

F26 ajoute la commande technique `seed_demo_inventory` dans `apps.inventory` :

```sh
python backend/manage.py seed_demo_inventory
```

Elle sert au developpement local et aux tests manuels de l'API inventory read-only avec des donnees de demonstration `InventoryItem`.

La commande refuse `DEBUG=False` et cree uniquement des items conformes Titan :

- materiels ;
- articles ;
- packs materiels.

Titan reste strictement limite a :

- `material` ;
- `article` ;
- `material_pack`.

La commande ne doit jamais creer :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F26 ne cree aucun endpoint d'ecriture, modele supplementaire, serializer, view, viewset, router, admin, role metier, JWT/token ou migration.

## Commande seed_demo_availability

F65 ajoute la commande technique locale/dev :

```sh
python backend/manage.py seed_demo_availability
```

Elle attend les items crees par `seed_demo_inventory`, puis cree ou met a jour une periode `blocked` pour `Sonorisation standard` et une periode `reserved` pour `Projecteur LED`. `Pack sonorisation + eclairage` reste disponible pour permettre une demonstration visible.

La commande refuse `DEBUG=False`, ne cree jamais d'item, ne touche pas aux periodes non gerees par F65 et reste idempotente. Le statut `reserved` est uniquement un statut technique `InventoryAvailability`; aucune reservation metier persistante n'est creee.

## InventoryAvailability

F29 ajoute `InventoryAvailability` comme modele minimal de socle pour les futures periodes d'indisponibilite ou de reservation d'un `InventoryItem`.

Champs principaux :

- `inventory_item` ;
- `status` ;
- `start_at` ;
- `end_at` ;
- `notes`.

Statuts autorises :

- `blocked` ;
- `reserved`.

La periode doit respecter `end_at > start_at`. Les statuts sont limites aux valeurs autorisees par une contrainte DB.

Rappel strict Titan : Titan autorise uniquement materiels, articles et packs materiels.

Titan exclut definitivement :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F29 ne cree pas encore le module complet de location ou de reservation. F29 ne cree aucun contrat, facture, paiement, client, serializer, view, URL, endpoint d'ecriture, viewset, router, admin, JWT/token ou role metier.

## Inventory availability selectors

F50 ajoute le selector interne `get_available_inventory_items_for_period`.

Ce selector retourne uniquement les `InventoryItem` :

- actifs ;
- non supprimes ;
- conformes Titan avec `material`, `article` ou `material_pack` ;
- disponibles sur une periode `[start_at, end_at)`.

Les items ayant un conflit `InventoryAvailability` sur la periode demandee avec un statut `blocked` ou `reserved` sont exclus.

F50 reste strictement interne au backend. Aucun endpoint API, serializer, view, URL, admin, frontend, modele, migration, reservation persistante, contrat, facture, paiement, client, stock, quantite ou ecriture DB n'est cree.

## Helpers de disponibilite

F30 ajoute le module interne `availability.py`.

Fonctions disponibles :

- `get_inventory_availability_conflicts` ;
- `is_inventory_item_available`.

La regle de chevauchement utilise des intervalles demi-ouverts `[start_at, end_at)`.

Une periode existante entre en conflit avec une periode demandee lorsque :

- `existing.start_at < requested_end_at` ;
- `existing.end_at > requested_start_at`.

Ainsi, une periode qui se termine exactement au debut de la demande ne bloque pas, et une periode qui commence exactement a la fin de la demande ne bloque pas.

Les statuts `blocked` et `reserved` rendent un item indisponible.

F37 consomme ces helpers depuis `apps.reservations` pour valider en lecture seule la disponibilite d'une future demande de reservation.

Cette consommation ne modifie pas `inventory`, ne cree aucun endpoint d'ecriture et ne change pas l'API inventory read-only.

F30 ne cree pas de reservation complete, contrat, facture, paiement, client, serializer, view, URL, endpoint d'ecriture, viewset, router, admin, JWT/token ou role metier. L'API inventory reste read-only.

## Smoke test seed demo + disponibilite

F31 ajoute un smoke test interne pour valider que les donnees creees par `seed_demo_inventory` peuvent etre utilisees avec le modele `InventoryAvailability` et les helpers de disponibilite.

`seed_demo_inventory` doit continuer a produire uniquement :

- `material` ;
- `article` ;
- `material_pack`.

Il ne doit jamais produire :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

Le test F31 verifie la disponibilite avant conflit, l'indisponibilite apres une periode `blocked` ou `reserved`, l'absence de blocage par une periode liee a un autre item, et la regle d'intervalles `[start_at, end_at)`.

F31 ne cree pas de reservation complete, contrat, facture, paiement, client, serializer, view, URL, endpoint d'ecriture, viewset, router, admin, JWT/token ou role metier. L'API inventory reste read-only.

## Decision disponibilite inventory

F32 formalise les regles du domaine disponibilite inventory dans [DEC-002-inventory-availability-domain.md](../../../docs/decisions/DEC-002-inventory-availability-domain.md).

Regles principales :

- les statuts qui rendent un item indisponible sont `blocked` et `reserved` ;
- une periode doit respecter `end_at > start_at` ;
- les intervalles sont traites comme `[start_at, end_at)` ;
- une periode existante chevauche une periode demandee si `existing.start_at < requested_end_at` et `existing.end_at > requested_start_at` ;
- les periodes d'un autre `InventoryItem` ne bloquent pas l'item demande ;
- l'API inventory reste read-only.

Cette decision ne cree pas de reservation complete, contrat, facture, paiement, client, serializer, view, URL, endpoint d'ecriture, viewset, router, admin, JWT/token ou role metier.
