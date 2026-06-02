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
