# Reservations

Role prevu : accueillir le futur domaine de reservation/location.

F33 active `reservations` comme app Django technique via `ReservationsConfig`.

Ce domaine preparera plus tard la reservation/location de materiels, articles et packs materiels.

Les futures reservations devront utiliser les regles de disponibilite documentees dans [DEC-002-inventory-availability-domain.md](../../../docs/decisions/DEC-002-inventory-availability-domain.md).

Avant toute confirmation future, les reservations devront verifier `InventoryAvailability` et les conflits de disponibilite.

Titan reste strictement limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan exclut toujours :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F33 ne cree :

- aucun modele ;
- aucune migration ;
- aucun serializer ;
- aucune view ;
- aucune URL ;
- aucun endpoint ;
- aucun admin ;
- aucun service metier complet ;
- aucun contrat ;
- aucune facture ;
- aucun paiement ;
- aucun client ;
- aucun frontend.

## Scope guard reservations

F34 ajoute `scope.py` comme garde-fou pur Python pour le futur domaine reservation/location.

Constantes exposees :

- `RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS` ;
- `RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS`.

Fonctions exposees :

- `is_reservable_inventory_item_kind(kind)` ;
- `assert_reservable_inventory_item_kind(kind)`.

Les kinds reservables pour Titan sont strictement :

- `material` ;
- `article` ;
- `material_pack`.

Les kinds interdits sont :

- `venue` ;
- `local` ;
- `room` ;
- `service` ;
- `event_service`.

Les kinds inconnus sont egalement refuses.

Ce garde-fou devra etre utilise plus tard par le futur module reservation/location avant toute creation ou confirmation de reservation Titan.

F34 ne cree aucune reservation. F34 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation periods

F35 ajoute `periods.py` comme socle de validation pure Python pour les futures periodes de reservation/location.

`ReservationPeriod` est une dataclass immuable qui porte :

- `start_at` ;
- `end_at`.

Helpers exposes :

- `is_aware_datetime(value)` ;
- `validate_reservation_period(start_at, end_at)` ;
- `make_reservation_period(start_at, end_at)`.

Regles de validation :

- `start_at` est obligatoire ;
- `end_at` est obligatoire ;
- `start_at` doit etre un datetime timezone-aware ;
- `end_at` doit etre un datetime timezone-aware ;
- `end_at` doit etre strictement superieur a `start_at`.

Les periodes sont interpretees comme des intervalles demi-ouverts `[start_at, end_at)`, en coherence avec [DEC-002-inventory-availability-domain.md](../../../docs/decisions/DEC-002-inventory-availability-domain.md).

F35 ne cree aucune reservation. F35 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation item validation

F36 ajoute `validation.py` comme helper pur Python pour valider une future demande de reservation item + periode.

`ReservationItemValidation` est une dataclass immuable qui porte :

- `inventory_item_kind` ;
- `period`.

Fonction exposee :

- `validate_reservation_item_request(inventory_item_kind, start_at, end_at)`.

Cette validation combine :

- `assert_reservable_inventory_item_kind` pour refuser tout kind non reservable ;
- `make_reservation_period` pour valider la periode.

Kinds autorises :

- `material` ;
- `article` ;
- `material_pack`.

`start_at` et `end_at` doivent etre des datetimes timezone-aware.

La periode doit respecter `end_at > start_at` et reste interpretee comme un intervalle demi-ouvert `[start_at, end_at)`.

F36 ne cree aucune reservation. F36 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation availability validation

F37 ajoute `availability.py` comme helper interne pour valider une future demande de reservation item + periode et verifier sa disponibilite.

Dataclasses exposees :

- `ReservationItemAvailabilityDetails` ;
- `ReservationItemAvailabilityValidation`.

Fonction exposee :

- `validate_reservation_item_availability_request(inventory_item, inventory_item_kind, start_at, end_at)`.

Cette validation combine :

- `validate_reservation_item_request` pour valider le kind reservable et la periode ;
- `get_inventory_availability_conflicts` pour lire les conflits `InventoryAvailability` existants.

Le helper retourne :

- `valid` ;
- `available` ;
- `errors` ;
- `inventory_unit_count` ;
- `details`.

`inventory_unit_count` reste `None` en F37, car aucun champ quantite, unite ou stock n'existe encore sur `InventoryItem`.

Le helper lit la DB uniquement pour verifier les conflits de disponibilite. Il ne cree aucune reservation et n'ecrit jamais en DB.

Kinds reservables :

- `material` ;
- `article` ;
- `material_pack`.

Titan exclut toujours :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F37 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation preview service

F40 ajoute `services.py` comme couche service interne mince pour orchestrer la preview de reservation item.

Fonction exposee :

- `preview_reservation_item_service`.

Le service delegue a `preview_reservation_item_request` et ne duplique pas la logique F38.

Il ne cree aucune reservation persistante, n'ecrit jamais en DB et ne cree aucun endpoint API.

F40 ne cree aucun modele, migration, serializer, view, URL, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation item preview

F38 ajoute `preview.py` comme value object interne pour preparer une future demande de reservation item.

Objets exposes :

- `ReservationItemPreviewStatus` ;
- `ReservationItemPreview` ;
- `preview_reservation_item_request`.

Les statuts possibles sont :

- `invalid` ;
- `unavailable` ;
- `available`.

La preview compose uniquement le helper F37 `validate_reservation_item_availability_request`. Elle n'appelle pas directement les helpers inventory de conflits et ne double pas la lecture DB.

`period` vaut `None` lorsque la validation F37 echoue. `conflicts` vaut `()` lorsque F37 ne retourne pas de details. `inventory_unit_count` reste `None` tant qu'aucun champ quantite, unite ou stock n'existe sur `InventoryItem`.

F38 ne cree aucune reservation persistante, n'ecrit jamais en DB, ne fait aucun calcul commercial et ne cree aucun devis.

Titan reste strictement limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan exclut toujours :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F38 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.
