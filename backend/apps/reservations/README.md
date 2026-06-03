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
