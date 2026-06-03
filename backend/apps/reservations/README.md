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
