# Inventory

Role prevu : accueillir les futurs materiels, articles, packs materiels et le stock partage.

F16 active `inventory` comme app Django technique via `InventoryConfig`.

Son role futur est de porter les materiels, articles, packs materiels et le stock partage.

Regle Titan a conserver : Titan autorise uniquement materiels/articles et packs materiels. Titan ne doit jamais inclure local, salle, lieu, service annexe ou service evenementiel. Aucune configuration alternative, aucun feature flag, aucun champ et aucune permission ne doit permettre cela.

Hors perimetre F16 : cette regle n'est pas implementee en code et aucune logique de stock n'est creee.

Aucun modele, migration, serializer, viewset, endpoint ou logique metier n'est cree dans ce domaine en F16.
