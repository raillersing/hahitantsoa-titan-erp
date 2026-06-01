# Common

Role prevu : accueillir de futurs utilitaires partages, types communs et logique transversale backend.

F14 active `common` comme app Django technique via `CommonConfig`.

F15 ajoute des modeles abstraits techniques :

- `UUIDModel` : cle primaire UUID reutilisable.
- `TimestampedModel` : champs techniques `created_at` et `updated_at`.
- `SoftDeleteModel` : champs techniques de suppression logique.
- `AuditableModel` : references techniques optionnelles vers l'utilisateur createur et modificateur.

Ces classes sont abstraites uniquement. Elles ne creent aucune table, aucune migration, aucun endpoint et aucune logique metier.

Elles ne doivent pas etre utilisees pour contourner les regles metier Titan. Titan autorise uniquement materiels/articles et packs materiels ; Titan ne doit jamais inclure local, salle, lieu, service annexe ou service evenementiel.
