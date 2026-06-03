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
