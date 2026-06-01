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

Hors perimetre F17 : aucune logique de stock, reservation, facturation ou disponibilite n'est creee.

Aucun modele, migration, serializer, viewset, endpoint ou table n'est cree dans ce domaine en F17.
