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

## Commande seed_dev_user

F25 ajoute la commande technique `seed_dev_user` dans `apps.common` :

```sh
python backend/manage.py seed_dev_user
```

Elle appartient a `common` car elle sert d'utilitaire transversal local/dev pour creer ou mettre a jour un utilisateur standard de developpement a partir de variables d'environnement.

Variables lues :

- `DJANGO_DEV_USERNAME`
- `DJANGO_DEV_PASSWORD`
- `DJANGO_DEV_EMAIL` optionnel

La commande refuse l'execution lorsque `DEBUG=False`, ne cree ni staff user, ni superuser, ni role metier, et ne doit jamais servir de mecanisme de provisioning production. Elle n'est pas une fonctionnalite metier et ne cree aucun modele, endpoint ou migration.
